"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session) {
        router.replace("/dashboard");
        return;
      }

      setChecking(false);
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function signInWithGoogle() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error: authError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
          },
        });

      if (authError) {
        throw authError;
      }
    } catch (err) {
      console.error("Google sign-in error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Google sign-in could not be started."
      );

      setLoading(false);
    }
  }

  async function sendMagicLink(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const redirectTo = `${window.location.origin}/auth/confirm`;

      const { error: authError } =
        await supabase.auth.signInWithOtp({
          email: trimmedEmail,
          options: {
            emailRedirectTo: redirectTo,
          },
        });

      if (authError) {
        throw authError;
      }

      setMessage(
        "Check your email for a secure sign-in link."
      );
    } catch (err) {
      console.error("Magic link error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not send the sign-in link."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="login-page">
        <div className="login-loading">
          <div className="brand">
            <div className="brand-name">
              Aarogya<span>Vaani</span>
            </div>

            <div className="brand-subtitle">
              Digital Health Locker
            </div>
          </div>

          <div className="loading">
            Checking your session…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-container">
        {/* Brand */}
        <section className="login-brand">
          <div className="login-logo">
            AV
          </div>

          <div>
            <div className="brand-name">
              Aarogya<span>Vaani</span>
            </div>

            <div className="brand-subtitle">
              Digital Health Locker
            </div>
          </div>
        </section>

        {/* Main message */}
        <section className="login-intro">
          <p className="eyebrow">
            YOUR HEALTH · YOUR RECORDS
          </p>

          <h1>
            Keep your health
            <br />
            records in one place.
          </h1>

          <p>
            Store medical documents securely, understand
            your health history, and choose what to share
            when you visit a healthcare professional.
          </p>
        </section>

        {/* Login card */}
        <section className="login-card">
          <h2>
            Sign in to AarogyaVaani
          </h2>

          <p className="login-card-text">
            Your account gives you access to your personal
            health locker and family profiles.
          </p>

          {/* Google */}
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={signInWithGoogle}
            disabled={loading}
          >
            <span
              aria-hidden="true"
              style={{
                fontWeight: 800,
                marginRight: 8,
              }}
            >
              G
            </span>

            {loading
              ? "Connecting…"
              : "Continue with Google"}
          </button>

          {/* Divider */}
          <div className="login-divider">
            <span>or</span>
          </div>

          {/* Magic link */}
          <form onSubmit={sendMagicLink}>
            <div className="form-group">
              <label
                className="form-label"
                htmlFor="email"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-secondary btn-full"
              disabled={loading}
            >
              Send secure sign-in link
            </button>
          </form>

          {message ? (
            <div
              className="status status-success"
              style={{
                marginTop: 12,
                width: "100%",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              {message}
            </div>
          ) : null}

          {error ? (
            <div
              className="status status-danger"
              style={{
                marginTop: 12,
                width: "100%",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          ) : null}
        </section>

        {/* Trust / privacy */}
        <section className="login-trust">
          <div className="trust-item">
            <span className="trust-icon">✓</span>

            <div>
              <strong>Private by design</strong>

              <p>
                Your health records are kept in your
                account and are not automatically shared.
              </p>
            </div>
          </div>

          <div className="trust-item">
            <span className="trust-icon">□</span>

            <div>
              <strong>Original documents preserved</strong>

              <p>
                Keep the source document alongside
                extracted information for verification.
              </p>
            </div>
          </div>

          <div className="trust-item">
            <span className="trust-icon">↗</span>

            <div>
              <strong>Share when you choose</strong>

              <p>
                Healthcare sharing is designed around
                patient-controlled access.
              </p>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <p className="login-disclaimer">
          AarogyaVaani helps organize and understand
          health records. It does not replace a qualified
          healthcare professional or provide medical
          diagnosis.
        </p>
      </div>
    </main>
  );
}