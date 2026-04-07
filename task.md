# First Interview Assignment

## Overview

This assignment evaluates your ability to work in our **spec-driven, AI-native development workflow**. You'll build a fintech feature from scratch using the same process we use daily at Lovie: write a detailed spec, implement it, test it end-to-end, and automate the entire workflow.

**Time Expectation**: 3-4 hours

**What We're Evaluating**:

- **Language Mastery**: Can you write specs so clear that AI (and humans) execute them flawlessly?
- **Technical Depth**: Do you understand banking/fintech well enough to make architectural decisions?
- **Vibe Coding**: Can you ship a working prototype quickly using modern AI tools?
- **Process Discipline**: Can you follow a structured workflow that scales with AI agents?

---

## The Assignment: Build a P2P Payment Request Feature

### Context

You're building a feature for a consumer fintech app that allows users to **request money from friends**. Think Venmo's "Request" feature or Cash App's payment requests.

### Core Requirements

Build a web or mobile app with the following functionality:

1. **Request Creation Flow**
    - User enters recipient's email/phone, amount, and optional note
    - System validates inputs (amount > 0, valid contact format)
    - Creates a payment request with unique ID and shareable link
2. **Request Management Dashboard**
    - List of outgoing requests (sent by user) showing status: Pending, Paid, Declined, Expired
    - List of incoming requests (received by user) with actions: Pay, Decline, View Details
    - Filter by status and search by recipient/sender
3. **Request Detail View**
    - Shows request amount, note, sender/recipient info, timestamp
    - For incoming requests: displays "Pay" and "Decline" buttons
    - For outgoing requests: displays current status and "Cancel" option if pending
4. **Payment Fulfillment Simulation**
    - When user clicks "Pay" on an incoming request, simulate payment processing
    - Show loading state (2-3 seconds) then success confirmation
    - Update request status to "Paid" and reflect in both sender and recipient dashboards
5. **Request Expiration**
    - Requests expire after 7 days if not paid or declined
    - Display expiration countdown on request details
    - Expired requests cannot be paid

### Technical Requirements

- **Authentication**: Simple email-based auth (magic link or mock auth is fine)
- **Data Persistence**: Use any database (SQLite, PostgreSQL, Supabase, Firebase, etc.)
- **Responsive Design**: Must work on mobile and desktop (web apps only)
- **Deployment**: Publicly accessible URL (Vercel, Netlify, Expo Go, etc.)

---

## Required Workflow: GitHub Spec-Kit

You **must** use [GitHub Spec-Kit](https://github.com/github/spec-kit) for this assignment. Research how it works and follow its workflow to:

- Generate your spec and implementation plan
- Break down tasks
- Build using an **agentic AI coding tool** (Cursor, Claude Code, v0, Lovable, Windsurf, etc.) — **required**
- Use any tech stack (React, Next.js, React Native, Expo, SwiftUI, etc.)

Additionally:

- Write **automated E2E tests** using Playwright, Cypress, Maestro (mobile), Detox, or similar
- Generate an **automated screen recording** of your E2E tests running (Playwright/Cypress have built-in video recording)

---

## Submission Requirements

### 1. GitHub Repository

- Public repo with clear README
- Include:
    - Spec-Kit generated files
    - Source code
    - E2E test suite
    - Screen recording video (or link)
    - Setup instructions

### 2. Live Demo

- Deploy to a public URL
- Include URL in README
- Should be testable without local setup

### 3. README

Your README should include:

- Project overview
- Live demo URL
- Setup instructions for local development
- How to run E2E tests
- Tech stack and AI tools used

---

## Evaluation Criteria

### Language Mastery (30%)

- **Spec Clarity**: Is your spec detailed enough that another PM or AI could implement it without asking questions?
- **Edge Case Coverage**: Did you anticipate and document error states, validation rules, and edge cases?
- **Structure**: Is the spec organized, scannable, and comprehensive?

### Technical Depth (25%)

- **Architecture**: Sound technical decisions for data models, API design, and state management?
- **Fintech Understanding**: Do you handle amounts correctly (decimal precision), validate inputs, and consider security?
- **Code Quality**: Clean, maintainable code (even if AI-generated)?

### Execution Speed (20%)

- **Shipping Velocity**: Did you ship a working prototype quickly?
- **Pragmatism**: Did you make smart trade-offs to move fast without sacrificing core functionality?

### Process Discipline (25%)

- **Spec-Kit Usage**: Did you properly use Spec-Kit workflow?
- **E2E Testing**: Comprehensive test coverage of critical paths?
- **Automation**: Is the screen recording fully automated via test suite?
- **Documentation**: Clear documentation showing your process?

---

## Submission Deadline

**Submit within 7 days** of receiving this assignment.

Send the following to [[hiring@lovie.com](mailto:hiring@lovie.com)]:

1. GitHub repo URL
2. Live demo URL with showing how did you build. Your prompts etc etc..
3. Brief cover note (2-3 paragraphs) answering:
    - What was the most challenging part of this assignment?
    - How did AI tools help or hinder your process?

---

## Questions?

If you have clarifying questions about requirements, email us. We'll respond within 24 hours.

**Note**: Questions about "what should I build?" indicate the spec is unclear—that's part of the exercise. Make reasonable assumptions and document them in your spec.

---

## Why This Assignment?

This mirrors our daily workflow at Lovie:

1. **You write detailed specs** that serve as source of truth
2. **You build quickly** using AI tools (vibe coding)
3. **You test rigorously** with automated E2E tests
4. **You document the process** so it's repeatable

If this assignment excites you, you'll thrive here. If it feels tedious or unclear, this role might not be the right fit.

Good luck! We're excited to see what you build.