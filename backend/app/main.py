from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import traceback
import json
import base64
import tempfile
import os
from dotenv import load_dotenv

load_dotenv()
import re
import fitz  # PyMuPDF
from groq import Groq


# ============================================================
# CONFIG
# ============================================================

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = FastAPI()


# Allow local development + optional production frontend.
allowed_origins =[
    "http://localhost:3000",
    "https://aarogya-vaani.vercel.app",
]

frontend_origin = os.getenv("FRONTEND_ORIGIN")
if frontend_origin:
    allowed_origins.append(frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# SAFE EXTRACTION FALLBACK
# ============================================================

def empty_extraction(
    document_type: str,
    error_message: str | None = None,
) -> dict:
    """
    Safe extraction fallback.

    Never invent patient names, diagnoses, medicines,
    doctors, dates, or laboratory values.
    """

    return {
        "document_type": document_type,
        "patient_name": None,
        "date": None,
        "diagnosis": None,
        "medicines": [],
        "doctor_name": None,
        "lab_metrics": [],
        "summary": None,
        "extraction_status": "needs_review",
        "confidence": "low",
        "extraction_error": error_message,
    }


# ============================================================
# JSON CLEANING
# ============================================================

def clean_json_response(raw_response: str) -> str:
    """
    Remove common model wrappers before attempting JSON parsing.
    """

    cleaned = (raw_response or "").strip()

    # Remove Qwen thinking blocks.
    cleaned = re.sub(
        r"<think>.*?</think>",
        "",
        cleaned,
        flags=re.DOTALL | re.IGNORECASE,
    ).strip()

    # Handle unmatched closing think tag.
    if "</think>" in cleaned.lower():
        parts = re.split(
            r"</think>",
            cleaned,
            maxsplit=1,
            flags=re.IGNORECASE,
        )
        cleaned = parts[-1].strip()

    # Remove markdown JSON fences.
    cleaned = re.sub(
        r"^```(?:json)?\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )

    cleaned = re.sub(
        r"\s*```$",
        "",
        cleaned,
    ).strip()

    return cleaned


def parse_json_safely(raw_response: str) -> dict | None:
    """
    Parse a JSON object without inventing clinical information.
    """

    cleaned = clean_json_response(raw_response)

    if not cleaned:
        return None

    # Attempt 1: entire response.
    try:
        parsed = json.loads(cleaned)

        if isinstance(parsed, dict):
            return parsed

    except json.JSONDecodeError:
        pass

    # Attempt 2: locate first JSON object.
    start = cleaned.find("{")

    if start != -1:
        depth = 0
        in_string = False
        escape = False

        for index in range(start, len(cleaned)):
            char = cleaned[index]

            if escape:
                escape = False
                continue

            if char == "\\":
                escape = True
                continue

            if char == '"':
                in_string = not in_string
                continue

            if in_string:
                continue

            if char == "{":
                depth += 1

            elif char == "}":
                depth -= 1

                if depth == 0:
                    candidate = cleaned[start:index + 1]

                    try:
                        parsed = json.loads(candidate)

                        if isinstance(parsed, dict):
                            return parsed

                    except json.JSONDecodeError:
                        # Try removing trailing commas.
                        try:
                            cleaned_candidate = re.sub(
                                r",\s*([\]}])",
                                r"\1",
                                candidate,
                            )

                            parsed = json.loads(cleaned_candidate)

                            if isinstance(parsed, dict):
                                return parsed

                        except Exception:
                            pass

                    break

    return None


# ============================================================
# NORMALIZATION
# ============================================================

def normalize_extracted_data(
    data: dict,
    document_type: str,
) -> dict:
    """
    Normalize model output.

    Missing/invalid fields are discarded rather than guessed.
    """

    medicines = data.get("medicines") or []
    lab_metrics = data.get("lab_metrics") or []

    if not isinstance(medicines, list):
        medicines = []

    if not isinstance(lab_metrics, list):
        lab_metrics = []

    clean_medicines = []

    for medicine in medicines:
        if isinstance(medicine, dict):
            clean_medicines.append(
                {
                    "name": medicine.get("name"),
                    "dosage": medicine.get("dosage"),
                }
            )

    clean_lab_metrics = []

    for metric in lab_metrics:
        if isinstance(metric, dict):
            clean_lab_metrics.append(
                {
                    "test_name": metric.get("test_name"),
                    "value": metric.get("value"),
                    "status": metric.get("status"),
                    "reference_range": metric.get("reference_range"),
                }
            )

    confidence = data.get("confidence")

    if confidence not in {"high", "medium", "low"}:
        confidence = "medium"

    extraction_status = data.get(
        "extraction_status",
        "extracted",
    )

    if extraction_status not in {
        "extracted",
        "needs_review",
    }:
        extraction_status = "needs_review"

    return {
        "document_type": document_type,
        "patient_name": data.get("patient_name"),
        "date": data.get("date"),
        "diagnosis": data.get("diagnosis"),
        "medicines": clean_medicines,
        "doctor_name": data.get("doctor_name"),
        "lab_metrics": clean_lab_metrics,
        "summary": data.get("summary"),
        "extraction_status": extraction_status,
        "confidence": confidence,
        "extraction_error": data.get("extraction_error"),
    }


# ============================================================
# PROMPT
# ============================================================

def build_extraction_prompt(document_type: str) -> str:

    if document_type == "lab_report":

        return """
You are extracting information from a medical laboratory report.

Read ONLY the information that is actually visible and legible
in the supplied image(s).

Do NOT diagnose the patient.

Do NOT guess missing values.

Do NOT infer a condition from a laboratory result.

Do NOT invent patient information.

If something is unreadable or absent, use null.

For laboratory tests, extract:
- test name
- measured value
- status if explicitly shown
- reference range if explicitly shown

Return ONLY a JSON object.

Use exactly this structure:

{
  "document_type": "lab_report",
  "patient_name": null,
  "date": null,
  "diagnosis": null,
  "medicines": [],
  "doctor_name": null,
  "lab_metrics": [
    {
      "test_name": null,
      "value": null,
      "status": null,
      "reference_range": null
    }
  ],
  "summary": null,
  "extraction_status": "extracted",
  "confidence": "medium",
  "extraction_error": null
}

Rules:
- Never guess.
- Never fabricate a laboratory value.
- Never fabricate a reference range.
- Never convert or reinterpret a result.
- summary must only describe information visibly present.
- extraction_status must be "needs_review" if important information is unclear.
- confidence must be "high", "medium", or "low".
"""

    return f"""
You are extracting information from a medical {document_type}.

Read ONLY information that is actually visible and legible
in the supplied image(s).

Never guess.

Never invent:
- patient names
- dates
- diagnoses
- medicines
- dosages
- doctors

If something is missing or unreadable, use null or [].

Return ONLY one JSON object.

Use exactly this structure:

{{
  "document_type": "{document_type}",
  "patient_name": null,
  "date": null,
  "diagnosis": null,
  "medicines": [
    {{
      "name": null,
      "dosage": null
    }}
  ],
  "doctor_name": null,
  "lab_metrics": [],
  "summary": null,
  "extraction_status": "extracted",
  "confidence": "medium",
  "extraction_error": null
}}

Rules:
- Never guess unclear handwriting.
- Never invent a medicine.
- Never invent a dosage.
- Never invent a diagnosis.
- Never invent a doctor.
- summary must contain only information supported by the document.
- extraction_status must be "needs_review" if important information is unclear.
- confidence must be "high", "medium", or "low".
"""


# ============================================================
# IMAGE EXTRACTION
# ============================================================

async def create_image_payloads(
    file: UploadFile,
    document_type: str,
):
    file_bytes = await file.read()

    if not file_bytes:
        raise ValueError("The uploaded document is empty.")

    image_payloads = []

    is_pdf = (
        (
            file.filename
            and file.filename.lower().endswith(".pdf")
        )
        or file.content_type == "application/pdf"
    )

    if is_pdf:

        print("Converting PDF document...")

        temp_pdf_path = None

        try:
            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=".pdf",
            ) as temp_pdf:

                temp_pdf.write(file_bytes)
                temp_pdf_path = temp_pdf.name

            pdf_document = fitz.open(temp_pdf_path)

            total_pages = len(pdf_document)

            print(f"Total PDF pages: {total_pages}")

            # Use up to 3 pages.
            # This is safer for lab reports than skipping page 1.
            target_page_indices = list(
                range(min(total_pages, 3))
            )

            for page_index in target_page_indices:

                try:
                    page = pdf_document[page_index]

                    # Slightly higher resolution for medical text.
                    pix = page.get_pixmap(
                        dpi=170,
                        alpha=False,
                    )

                    image_bytes = pix.tobytes("jpeg")

                    encoded_img = base64.b64encode(
                        image_bytes
                    ).decode("utf-8")

                    image_payloads.append(encoded_img)

                    print(
                        f"Rendered PDF page {page_index + 1}"
                    )

                except Exception as page_error:

                    print(
                        f"Could not render page "
                        f"{page_index + 1}: {page_error}"
                    )

            pdf_document.close()

        finally:

            if (
                temp_pdf_path
                and os.path.exists(temp_pdf_path)
            ):
                try:
                    os.unlink(temp_pdf_path)
                except OSError:
                    pass

    else:

        encoded_img = base64.b64encode(
            file_bytes
        ).decode("utf-8")

        image_payloads.append(encoded_img)

    if not image_payloads:
        raise ValueError(
            "Could not extract any readable pages "
            "from the uploaded document."
        )

    return image_payloads


# ============================================================
# GROQ EXTRACTION
# ============================================================

def call_groq_vision(
    content_parts: list,
) -> str:

    print("Calling Groq vision model...")

    completion = client.chat.completions.create(
        model="qwen/qwen3.6-27b",
        messages=[
            {
                "role": "user",
                "content": content_parts,
            }
        ],
        temperature=0,
        max_tokens=2500,
    )

    content = (
        completion.choices[0].message.content
        or ""
    ).strip()

    print(
        "Raw AI output:\n",
        content[:5000],
    )

    return content


# ============================================================
# API
# ============================================================

@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "AarogyaVaani document extraction",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
    }


@app.post("/analyze")
async def analyze_scan(
    file: UploadFile = File(...),
    document_type: str = Form("prescription"),
):

    try:

        print("\n========================================")
        print("ANALYZING MEDICAL DOCUMENT")
        print("========================================")
        print(f"File: {file.filename}")
        print(f"Type: {document_type}")

        # ----------------------------------------------------
        # 1. Convert upload into images
        # ----------------------------------------------------

        image_payloads = await create_image_payloads(
            file,
            document_type,
        )

        print(
            f"Prepared {len(image_payloads)} image(s)"
        )

        # ----------------------------------------------------
        # 2. Build prompt
        # ----------------------------------------------------

        prompt = build_extraction_prompt(
            document_type
        )

        content_parts = [
            {
                "type": "text",
                "text": prompt,
            }
        ]

        for img in image_payloads:

            content_parts.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": (
                            "data:image/jpeg;base64,"
                            f"{img}"
                        )
                    },
                }
            )

        # ----------------------------------------------------
        # 3. Call vision model
        #
        # IMPORTANT:
        # Do NOT use Groq response_format=json_object.
        # The model is instructed to return JSON and we
        # safely parse/validate the response ourselves.
        # ----------------------------------------------------

        try:

            ai_response_str = call_groq_vision(
                content_parts
            )

        except Exception as ai_error:

            print(
                "Groq extraction error:",
                repr(ai_error),
            )

            return {
                "status": "success",
                "extracted_data": empty_extraction(
                    document_type,
                    "The document could not be analyzed "
                    "confidently. Please verify the "
                    "original document.",
                ),
            }

        # ----------------------------------------------------
        # 4. Parse JSON
        # ----------------------------------------------------

        extracted_data = parse_json_safely(
            ai_response_str
        )

        if extracted_data is None:

            print(
                "WARNING: Model returned invalid JSON."
            )

            print(
                "Response:",
                ai_response_str[:5000],
            )

            return {
                "status": "success",
                "extracted_data": empty_extraction(
                    document_type,
                    "The document was read, but the "
                    "information could not be converted "
                    "into reliable structured data. "
                    "Please verify the original document.",
                ),
            }

        # ----------------------------------------------------
        # 5. Normalize
        # ----------------------------------------------------

        normalized = normalize_extracted_data(
            extracted_data,
            document_type,
        )

        print(
            "Normalized extraction:",
            json.dumps(
                normalized,
                ensure_ascii=False,
            ),
        )

        # ----------------------------------------------------
        # 6. Return
        # ----------------------------------------------------

        return {
            "status": "success",
            "extracted_data": normalized,
        }

    except Exception:

        traceback.print_exc()

        return {
            "status": "success",
            "extracted_data": empty_extraction(
                document_type,
                "The document could not be analyzed "
                "confidently. Please verify the "
                "original document.",
            ),
        }