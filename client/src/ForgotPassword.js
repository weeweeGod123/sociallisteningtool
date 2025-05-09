// ForgotPassword.js

import React, { useState } from "react";
import "./ForgotPassword.css";
import { FaEnvelope } from "react-icons/fa";
import { Link } from "react-router-dom";

import forgotPasswordImage from "./assets/forgot-password.jpg";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleResetPassword = async () => {
    if (!email) return alert("Please enter your email.");

    try {
      const res = await fetch("http://localhost:5000/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Reset instructions sent to your email.");
      } else {
        setMessage(data.message || "Failed to send reset instructions.");
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      setMessage("Server error occurred. Try again later.");
    }
  };
  return (
    <div
      className="forgot-full-container"
      style={{ backgroundImage: `url(${forgotPasswordImage})` }}
    >
      <div className="forgot-card">
        <h2>Let’s get into your account</h2>

        <label htmlFor="email">Email address</label>
        <div className="input-group">
          <FaEnvelope className="icon" />
          <input id="email" type="email" placeholder="Enter your email" />
        </div>

        <button className="reset-button">Reset Password</button>

        <div className="link-container">
          <p className="back-to-login">
            <Link to="/">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
