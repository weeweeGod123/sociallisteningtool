import React, { useState } from "react";
import "./HelpPage.css";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";

const HelpPage = () => {
  const [openIndexes, setOpenIndexes] = useState([]);

  const toggleFAQ = (index) => {
    setOpenIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const faqs = [
    {
      icon: "🔐",
      question: "How do I reset my password?",
      answer:
        "Click 'Forgot Password' on the login page and follow the steps to receive a reset link via email.",
    },
    {
      icon: "📊",
      question: "What is Advanced Search?",
      answer:
        "Advanced Search allows you to refine your results using keywords, phrases, and boolean operators like AND, OR, NOT.",
    },
    {
      icon: "🌀",
      question: "How often is the data refreshed?",
      answer:
        "Data is updated daily from Twitter, Reddit, and other connected sources.",
    },
    {
      icon: "✉️",
      question: "How do I change my email address?",
      answer:
        "Go to the Settings page and update your email in the Account section.",
    },
    {
      icon: "🌐",
      question: "What browsers are supported?",
      answer:
        "We support the latest versions of Chrome, Firefox, Safari, and Edge.",
    },
    {
      icon: "⛔",
      question: "I'm having trouble logging in. What should I do?",
      answer:
        "Ensure your credentials are correct. Try clearing your browser cache. If the issue persists, contact support@example.com.",
    },
  ];

  return (
    <div className="help-wrapper">
      <div className="help-container">
        <h1>Help & Support</h1>
        <div className="help-card">
          <h2>FAQs</h2>
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`faq-item ${openIndexes.includes(index) ? "open" : ""}`}
            >
              <div className="faq-question" onClick={() => toggleFAQ(index)}>
                <span>{faq.icon} {faq.question}</span>
                <span className="toggle-icon">
                  {openIndexes.includes(index) ? <FaChevronDown /> : <FaChevronRight />}
                </span>
              </div>
              <div className="faq-answer">
                <p>{faq.answer}</p>
              </div>
            </div>
          ))}

          <h2 style={{ marginTop: "30px" }}>Still need help?</h2>
          <p>
            Email us at <strong>support@example.com</strong> or fill out the form below:
          </p>

          <form className="help-form" onSubmit={(e) => {
            e.preventDefault();
            alert("Message sent successfully!");
            e.target.reset();
          }}>
            <input type="text" name="name" placeholder="Your Name" required />
            <input type="email" name="email" placeholder="Your Email" required />
            <textarea name="message" placeholder="Your Message" rows="4" required></textarea>
            <button type="submit">Send Message</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;