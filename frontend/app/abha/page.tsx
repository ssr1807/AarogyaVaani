"use client";

import { useState } from "react";
import Link from "next/link";

export default function AbhaLoginPage() {
  const [abhaNumber, setAbhaNumber] = useState("");
  const [step, setStep] = useState<"input" | "otp" | "success">("input");
  const [otp, setOtp] = useState("");
  const [abhaProfile, setAbhaProfile] = useState<any>(null);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (abhaNumber.length < 10) {
      alert("Please enter a valid ABHA Number or Address");
      return;
    }
    // Simulate sending OTP
    setStep("otp");
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp !== "123456") {
      alert("Invalid OTP. Use '123456' for sandbox testing.");
      return;
    }
    
    // Simulate successful fetch of government health profile
    setAbhaProfile({
      name: "Kamuna Choubam",
      abhaAddress: abhaNumber.includes("@") ? abhaNumber : `${abhaNumber}@abdm`,
      gender: "Female",
      yearOfBirth: "1998",
      state: "Uttar Pradesh"
    });
    setStep("success");
  };

  return (
    <div className="min-h-screen bg-black flex justify-center items-start">
      <div className="w-full max-w-md min-h-screen bg-white text-gray-900 flex flex-col relative shadow-2xl pb-32">
        
        {/* Top Header */}
        <div className="bg-teal-700 text-white p-4 font-bold text-lg shadow-md flex items-center justify-between">
          <span>🇮🇳 ABHA / ABDM Link</span>
        </div>

        {/* Content Area */}
        <div className="p-6 flex flex-col gap-6 flex-grow justify-center">
          
          {step === "input" && (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <div className="w-16 h-16 bg-teal-100 text-teal-800 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold shadow-inner">
                  🛡️
                </div>
                <h2 className="text-xl font-bold text-gray-900">Connect Health ID</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Link your Ayushman Bharat Health Account (ABHA) to sync records securely.
                </p>
              </div>

              <div>
                <label className="text-xs text-gray-600 uppercase font-bold block mb-1">ABHA Number or Virtual Address</label>
                <input 
                  type="text"
                  placeholder="e.g. 14-2345-6789-0123 or name@abdm"
                  value={abhaNumber}
                  onChange={(e) => setAbhaNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900 text-sm focus:outline-none focus:border-teal-600"
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-teal-700 hover:bg-teal-600 text-white font-medium py-3 rounded-xl transition shadow-md mt-2"
              >
                Get Aadhaar OTP
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <h2 className="text-xl font-bold text-gray-900">Enter Verification OTP</h2>
                <p className="text-xs text-gray-500 mt-1">
                  OTP sent to mobile number linked with ABHA. <br />
                  <span className="text-teal-700 font-semibold">(Hint: Use 123456)</span>
                </p>
              </div>

              <div>
                <label className="text-xs text-gray-600 uppercase font-bold block mb-1">6-Digit OTP</label>
                <input 
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-center text-xl tracking-widest text-gray-900 font-bold focus:outline-none focus:border-teal-600"
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-teal-700 hover:bg-teal-600 text-white font-medium py-3 rounded-xl transition shadow-md mt-2"
              >
                Verify & Link Profile
              </button>
            </form>
          )}

          {step === "success" && abhaProfile && (
            <div className="flex flex-col items-center text-center gap-4 bg-teal-50 border border-teal-200 p-6 rounded-2xl">
              <div className="w-14 h-14 bg-teal-600 text-white rounded-full flex items-center justify-center text-2xl shadow-md">
                ✓
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">ABHA Linked Successfully!</h2>
                <p className="text-xs text-teal-800 font-medium mt-0.5">{abhaProfile.abhaAddress}</p>
              </div>

              <div className="w-full bg-white border border-teal-200 rounded-xl p-4 text-left text-xs space-y-2 shadow-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="font-bold text-gray-900">{abhaProfile.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">YOB / State:</span>
                  <span className="font-bold text-gray-900">{abhaProfile.yearOfBirth} | {abhaProfile.state}</span>
                </div>
              </div>

              <Link 
                href="/dashboard"
                className="w-full bg-teal-700 hover:bg-teal-600 text-white font-medium py-3 rounded-xl transition shadow-md mt-2"
              >
                Go to Dashboard
              </Link>
            </div>
          )}

        </div>

        {/* BOTTOM NAVIGATION BAR */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-3 px-6 flex justify-around items-center z-40">
          <Link href="/" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-700">
            <span className="text-xl">🏠</span>
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link href="/scan" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-700">
            <span className="text-xl">📸</span>
            <span className="text-xs font-medium">Scan</span>
          </Link>
          <Link href="/records" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-700">
            <span className="text-xl">📁</span>
            <span className="text-xs font-medium">Records</span>
          </Link>
        </div>

      </div>
    </div>
  );
}