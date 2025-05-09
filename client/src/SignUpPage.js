import React, { useState } from "react";
import "./SignUpPage.css";
import { FaEnvelope, FaLock, FaUser } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom"; // Add useNavigate hook
import googleLogo from "./assets/Google.jpg";
import backgroundImage from "./assets/SignUp.jpg";
import Modal from "./components/Modal";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [scrolledTerms, setScrolledTerms] = useState(false);
  const [scrolledPrivacy, setScrolledPrivacy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  
  // Add navigate hook for redirection
  const navigate = useNavigate();

  const isFormValid = agreed;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check for required fields
    if (!email || !password || !agreed) 
    {
      // Show an error message
      alert("Please fill in all fields and agree to the Terms of Service and Privacy Policy.");
      return;
    }
    
    try {
      const res = await fetch("http://localhost:5003/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("Signup successful! Redirecting to login page...");

        setName("");
        setEmail("");
        setPassword("");
        
        // Add redirect to login page
        navigate("/");
      } else {
        alert(data.message || "Signup failed.");
      }
    } catch (err) {
      console.error("Error signing up:", err);
      alert("An error occurred. Please try again.");
    }
  };

  return (
    <div
      className="signup-full-container"
      style={{
        backgroundImage: `url(${backgroundImage})`,
      }}
    >
      <div className="signup-card">
        <h2>Create Your Account</h2>

        <button className="google-button">
          <img src={googleLogo} alt="Google" className="google-icon" />
          Sign in with Google
        </button>

        <div className="divider"><span>Or</span></div>

        {/* Name Input */}
        <label>Your Name</label>
        <div className="input-group">
          <FaUser className="icon" />
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Email Input */}
        <label>Email address</label>
        <div className="input-group">
          <FaEnvelope className="icon" />
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Password Input */}
        <label>Password</label>
        <div className="input-group">
          <FaLock className="icon" />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "🙈" : "👁️"}
          </span>
        </div>

        {/* Checkbox Agreement */}
        <div className="agree-container">
          <input
            type="checkbox"
            id="agree"
            disabled={!scrolledTerms || !scrolledPrivacy}
            checked={agreed}
            onChange={() => setAgreed(!agreed)}
          />
          <label htmlFor="agree">
            I agree to the{" "}
            <span className="link-like" onClick={() => setShowTerms(true)}>
              Terms of Service
            </span>{" "}
            and{" "}
            <span className="link-like" onClick={() => setShowPrivacy(true)}>
              Privacy Policy
            </span>.
          </label>
        </div>

        {/* Create Account Button */}
        <button className="signup-button" onClick={handleSubmit} disabled={!isFormValid} >
          Create account
        </button>

        {/* Terms of Service Modal */}
        <Modal
          isOpen={showTerms}
          onClose={() => setShowTerms(false)}
          title="Terms of Service"
          requireScroll
          onScrolledToEnd={() => setScrolledTerms(true)}
        >
          <p><strong>1. Acceptance of Terms</strong><br />
            By creating an account, accessing, or using this application (Social Media Monitor), you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree, you must not use this Web App.
          </p>
          <p><strong>2. Account Registration</strong><br />
            You agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your credentials and for all activities that occur under your account.
          </p>
          <p><strong>3. Use of the App</strong><br />
            You agree not to use the App for any unlawful or unauthorized purpose. You may not copy, distribute, or modify any part of the App without permission. You may not attempt to breach the App's security.
          </p>
          <p><strong>4. Data and Analytics</strong><br />
            We process user data to deliver and improve services. You retain ownership of your content, but you grant us a license to use anonymized data to improve performance and user experience.
          </p>
          <p><strong>5. Privacy</strong><br />
            Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and safeguard your information.
          </p>
          <p><strong>6. Intellectual Property</strong><br />
            All materials, branding, and features of the App are the intellectual property of the development team or its licensors. Unauthorized use is prohibited.
          </p>
          <p><strong>7. Modifications to the App</strong><br />
            We reserve the right to update, modify, or discontinue the App (or portions of it) at any time without notice. We are not liable to you or any third party for such changes.
          </p>
          <p><strong>8. Limitation of Liability</strong><br />
            We are not liable for any indirect, incidental, or consequential damages resulting from your use or inability to use the App.
          </p>
          <p><strong>9. Termination</strong><br />
            We may terminate or suspend your account if we suspect you have violated these terms. Upon termination, you must stop using the App immediately.
          </p>
          <p><strong>10. Governing Law</strong><br />
            These terms shall be governed by the laws of [Your Country or State]. Any disputes will be resolved in the appropriate local jurisdiction.
          </p>
          <p><strong>11. Contact</strong><br />
            For questions or support, please contact us at <em>support@example.com</em>.
          </p>
        </Modal>

        {/* Privacy Policy Modal */}
        <Modal
          isOpen={showPrivacy}
          onClose={() => setShowPrivacy(false)}
          title="Privacy Policy"
          requireScroll
          onScrolledToEnd={() => setScrolledPrivacy(true)}
        >
          <p><strong>1. Information We Collect</strong><br />
            We collect personal information such as your name, email address, and usage data including device type, browser, IP address, and interaction data (pages visited, buttons clicked, etc.).
          </p>
          <p><strong>2. How We Use Your Information</strong><br />
            We use your data to:
          <ul>
          <li>Provide and maintain our services</li>
          <li>Improve the user experience</li>
          <li>Communicate important updates</li>
          <li>Secure the application from threats and misuse</li>
          </ul>
          </p>
          <p><strong>3. Sharing & Disclosure</strong><br />
            We do not sell your personal data. We may share your data with third-party providers who assist in operating our services (e.g., cloud providers), under strict confidentiality agreements.
          </p>
          <p><strong>4. Data Retention</strong><br />
            We retain your personal data only as long as necessary to provide our services or comply with legal obligations. Afterward, it is securely deleted.
          </p>
          <p><strong>5. Cookies & Tracking</strong><br />
            Our App may use cookies or similar technologies to analyze trends and administer the website. You can manage your cookie preferences via browser settings.
          </p>
          <p><strong>6. Your Rights</strong><br />
            You have the right to access, correct, delete, or limit the use of your data. To exercise these rights, please contact us at <em>privacy@example.com</em>.
          </p>
          <p><strong>7. Children's Privacy</strong><br />
            Our services are not intended for children under 13. We do not knowingly collect data from children. If we learn we have done so, we will delete it immediately.
          </p>
          <p><strong>8. Changes to This Policy</strong><br />
            We may update this Privacy Policy from time to time. We encourage you to review it regularly. Continued use of the App constitutes acceptance of the new terms.
          </p>
          <p><strong>9. Contact</strong><br />
            If you have questions about this policy, please contact us at <em>privacy@example.com</em>.
          </p>
        </Modal>

        {/* Already have an account */}
        <p className="login-link">
          Already have an account? <Link to="/">Log in here</Link>
        </p>
      </div>
    </div>
  );
}