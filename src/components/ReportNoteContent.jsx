import React from 'react';

function NoteEntry({ kind, label, children }) {
  if (!children) return null;

  return (
    <div className={`report-note-entry ${kind}`}>
      <span className="report-note-label">{label}</span>
      <p>{children}</p>
    </div>
  );
}

export default function ReportNoteContent({ profileNote, customerNote, sellerNote }) {
  return (
    <div className="report-note-list">
      <NoteEntry kind="profile" label="Client profile">{profileNote}</NoteEntry>
      <NoteEntry kind="customer" label="Customer">{customerNote}</NoteEntry>
      <NoteEntry kind="business" label="Business">{sellerNote}</NoteEntry>
    </div>
  );
}
