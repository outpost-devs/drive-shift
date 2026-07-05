# Drive-Shift 🚀

[![Frontend CI](https://github.com/outpost-devs/drive-shift/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/outpost-devs/drive-shift/actions/workflows/frontend-ci.yml)
[![Backend CI](https://github.com/outpost-devs/drive-shift/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/outpost-devs/drive-shift/actions/workflows/backend-ci.yml)

**Drive-Shift** is a secure web utility that moves files and folders directly server-to-server between two Google Drive accounts. It processes migrations entirely within Google's backend infrastructure, meaning zero data is routed through your local device or our servers' disks.

---

## 📂 Repository Navigation

All core documentation is located in the **[docs/](file:///d:/antigravity/drive-shift/docs)** folder:

* **[Product Requirements Document](file:///d:/antigravity/drive-shift/docs/Drive-Shift-PRD-v1.md)**: Specifications, technical architecture, and Material Design 3 guidelines.
* **[API Contract](file:///d:/antigravity/drive-shift/docs/API_CONTRACT.md)**: Frozen endpoints and SSE progress event shapes.
* **[Work Division](file:///d:/antigravity/drive-shift/docs/WORK_DIVISION.md)**: Parallel tracking guidelines and integration checkpoints.
* **[GitHub Setup Guide](file:///d:/antigravity/drive-shift/docs/GITHUB_SETUP_GUIDE.md)**: Organization repo practices and CI/CD setup details.
* **[Issue Backlog](file:///d:/antigravity/drive-shift/docs/GITHUB_ISSUES.md)**: Backlog mapping of our 45 development tasks.

---

## 🗂️ Project Monorepo Structure

```text
drive-shift/
├── .github/              # CI/CD Workflows & configurations
├── backend/              # Spring Boot Java application (Satish)
├── frontend/             # Next.js App Router application (Allen)
├── docs/                 # Product and API documentation
├── mcp-github-app.cjs    # Local custom GitHub App MCP launcher
└── README.md             # This file
```

---

## 📘 Developer Guides & Setup
For local environment installation, database migrations, deployment runbooks, and troubleshooting FAQs, please refer to the project **[GitHub Wiki](https://github.com/outpost-devs/drive-shift/wiki)**.

This is the test for workflow.
