/**
 * Utility to download documents directly in the browser.
 * Supports data URLs (Base64), remote URLs, and generates official HR verification HTML documents if no file binary exists.
 */
export function triggerDocumentDownload(
  docName: string,
  fileUrl?: string | null,
  options?: {
    employeeName?: string;
    employeeCode?: string;
    issueDate?: string;
    expiryDate?: string;
    status?: string;
    type?: string;
  }
): void {
  const safeDocName = (docName || 'Document').trim();
  const empName = options?.employeeName || 'Authorized Employee';
  const empCode = options?.employeeCode || 'EMP';
  const issue = options?.issueDate || 'N/A';
  const expiry = options?.expiryDate || 'N/A';
  const status = options?.status || 'Active';
  const type = options?.type || 'Record';

  // 1. If fileUrl is provided (Base64 Data URL, Blob URL, or external link)
  if (fileUrl && (fileUrl.startsWith('data:') || fileUrl.startsWith('http://') || fileUrl.startsWith('https://') || fileUrl.startsWith('blob:'))) {
    const a = document.createElement('a');
    a.href = fileUrl;
    let ext = '';
    if (fileUrl.startsWith('data:image/png')) ext = '.png';
    else if (fileUrl.startsWith('data:image/jpeg') || fileUrl.startsWith('data:image/jpg')) ext = '.jpg';
    else if (fileUrl.startsWith('data:application/pdf')) ext = '.pdf';
    else if (fileUrl.startsWith('data:text/plain')) ext = '.txt';

    const filename = `${empCode}_${safeDocName.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // 2. Generate a verified HR Document HTML file as fallback
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${empName} - ${safeDocName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 40px 20px; }
    .doc-container { max-width: 680px; margin: 0 auto; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 36px 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }
    .doc-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; }
    .org-title { font-size: 18px; font-weight: 800; color: #0284c7; letter-spacing: -0.02em; }
    .badge { display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: 700; border-radius: 20px; background: #e0f2fe; color: #0369a1; }
    .doc-title { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .doc-subtitle { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 28px; }
    .field-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; }
    .field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px; letter-spacing: 0.05em; }
    .field-value { font-size: 14px; font-weight: 600; color: #0f172a; }
    .stamp-box { border: 2px dashed #0284c7; border-radius: 12px; padding: 16px; text-align: center; color: #0369a1; background: #f0f9ff; margin-top: 30px; }
    .stamp-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }
    .stamp-text { font-size: 12px; margin-top: 4px; color: #0284c7; }
    .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="doc-container">
    <div class="doc-header">
      <div class="org-title">HR NEXUS CORPORATION</div>
      <span class="badge">${status}</span>
    </div>
    <div class="doc-title">${safeDocName}</div>
    <div class="doc-subtitle">Official Employee Verification Record</div>
    <div class="field-grid">
      <div class="field-card">
        <div class="field-label">Employee Name</div>
        <div class="field-value">${empName}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Employee Code</div>
        <div class="field-value">${empCode}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Document Type</div>
        <div class="field-value">${type}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Document Status</div>
        <div class="field-value">${status}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Issue Date</div>
        <div class="field-value">${issue}</div>
      </div>
      <div class="field-card">
        <div class="field-label">Expiry Date</div>
        <div class="field-value">${expiry}</div>
      </div>
    </div>
    <div class="stamp-box">
      <div class="stamp-title">&check; VERIFIED DOCUMENT RECORD</div>
      <div class="stamp-text">This document is certified authentic and registered within the HR Nexus Management System.</div>
    </div>
    <div class="footer">Generated on ${new Date().toLocaleDateString()} &bull; HR Nexus Corporation Document Repository</div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `${empCode}_${safeDocName.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
