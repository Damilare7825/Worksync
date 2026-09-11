import React, { useState, useMemo, useRef } from 'react';

/**
 * A plain textarea plus a lightweight @mention popup. Typing "@" followed
 * by characters filters `members` by name; picking one inserts their
 * display name into the text and records their id in `mentionedIds` — the
 * actual mention validation/creation happens server-side against real
 * project membership (see comment.service.js), this is just the picker
 * that makes typing one convenient. Free text with an "@" that's never
 * resolved to a member id is never sent as a mention.
 */
export function MentionInput({ value, onChange, mentionedIds, onMentionedIdsChange, placeholder, rows = 2, onSubmitShortcut, members }) {
  const [query, setQuery] = useState(null); // null = popup closed, string = active search text
  const textareaRef = useRef(null);

  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 5);
  }, [query, members]);

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);

    const cursor = e.target.selectionStart;
    const uptoCursor = text.slice(0, cursor);
    const match = uptoCursor.match(/@([\w\s]{0,30})$/);
    setQuery(match ? match[1] : null);
  };

  const pickMember = (member) => {
    const cursor = textareaRef.current.selectionStart;
    const uptoCursor = value.slice(0, cursor);
    const replaced = uptoCursor.replace(/@([\w\s]{0,30})$/, `@${member.name} `);
    const newValue = replaced + value.slice(cursor);
    onChange(newValue);
    if (!mentionedIds.includes(member.id)) {
      onMentionedIdsChange([...mentionedIds, member.id]);
    }
    setQuery(null);
    textareaRef.current?.focus();
  };

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && query === null) {
            e.preventDefault();
            onSubmitShortcut?.();
          }
          if (e.key === 'Escape') setQuery(null);
        }}
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {query !== null && matches.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pickMember(m);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50"
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
