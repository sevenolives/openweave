'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { User } from '@/lib/api';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  members: User[];
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

export default function MentionInput({
  value,
  onChange,
  members,
  placeholder = 'Write a comment…',
  disabled = false,
  rows = 3,
  className = '',
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = members.filter(
    (m) =>
      m.username.toLowerCase().includes(query.toLowerCase()) ||
      (m.name || '').toLowerCase().includes(query.toLowerCase())
  );

  const insertMention = useCallback(
    (user: User) => {
      if (mentionStart === null) return;
      const before = value.slice(0, mentionStart);
      const cursorPos = textareaRef.current?.selectionStart ?? value.length;
      const after = value.slice(cursorPos);
      const mention = `@[${user.username}] `;
      const newValue = before + mention + after;
      onChange(newValue);
      setShowDropdown(false);
      setMentionStart(null);
      // Restore cursor
      requestAnimationFrame(() => {
        const pos = before.length + mention.length;
        textareaRef.current?.setSelectionRange(pos, pos);
        textareaRef.current?.focus();
      });
    },
    [mentionStart, value, onChange]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart;
    onChange(newValue);

    // Detect @ trigger
    const textBeforeCursor = newValue.slice(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex >= 0) {
      // Make sure @ is at start or preceded by whitespace
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      // No spaces in the query, and no closing bracket (already completed mention)
      if (/\s/.test(charBefore) || atIndex === 0) {
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('[')) {
          setQuery(textAfterAt);
          setMentionStart(atIndex);
          setShowDropdown(true);
          setSelectedIndex(0);
          return;
        }
      }
    }
    setShowDropdown(false);
    setMentionStart(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setMentionStart(null);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        rows={rows}
        className={`w-full px-4 py-3 text-sm resize-none focus:outline-none placeholder-gray-400 ${className}`}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      {showDropdown && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 right-0 mb-1 bg-[#111118] border border-[#222233] rounded-lg shadow-lg max-h-48 overflow-y-auto z-50"
        >
          {filtered.map((user, i) => (
            <button
              key={user.id}
              type="button"
              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                i === selectedIndex ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-[#1a1a2e] text-gray-300'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                  user.user_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'
                }`}
              >
                {user.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium truncate">{user.name || user.username}</span>
                  <span className="text-xs text-gray-400">@{user.username}</span>
                </div>
              </div>
              <span className="text-sm flex-shrink-0">{user.user_type === 'BOT' ? '🤖' : '👤'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
