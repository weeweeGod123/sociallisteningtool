// NewPassword.js
import React, { useState } from "react";
import "./NewPassword.css";
import { FaLock } from "react-icons/fa";

import newPasswordImage from "./assets/NewPassword.jpg";

export default function NewPassword() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div
      className="new-password-container"
      style={{
        background: `url(${newPasswordImage}) center center / cover no-repeat`,
      }}

    >
      <div className="new-password-card">
        <h2>Change your Password</h2>

        <label htmlFor="new-password">New Password</label>
        <div className="input-group">
          <FaLock className="icon" />
          <input
            type={showPassword ? "text" : "password"}
            id="new-password"
            placeholder="Enter new password"
          />
          <span
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "🙈" : "👁️"}
          </span>
        </div>

        <label htmlFor="confirm-password">Re-Enter New Password</label>
        <div className="input-group">
          <FaLock className="icon" />
          <input
            type={showConfirmPassword ? "text" : "password"}
            id="confirm-password"
            placeholder="Re-enter new password"
          />
          <span
            className="toggle-password"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? "🙈" : "👁️"}
          </span>
        </div>

        <button className="reset-button">Reset Password</button>
      </div>
    </div>
  );
}
