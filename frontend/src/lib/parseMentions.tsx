import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

// Username charset matches the backend register rule ([a-z0-9._], 3-24); we accept
// either case here and link verbatim. The negative lookbehind keeps "email@x.com"
// from turning "@x" into a mention (the char before @ is a word char).
const MENTION_RE = /(?<!\w)@([A-Za-z0-9._]+)/g;

// Split a comment body into plain strings + clickable @mention <Link>s.
// "@alice hello" → [<Link>@alice</Link>, " hello"]; "email@gmail.com" → ["email@gmail.com"].
// A trailing "." / "_" is treated as punctuation, not part of the username
// (e.g. "@alice." → link "@alice" + "."), since usernames rarely end that way.
export function parseMentions(text: string): (string | ReactElement)[] {
  const nodes: (string | ReactElement)[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(MENTION_RE)) {
    const start = match.index ?? 0;
    const raw = match[1];
    const username = raw.replace(/[._]+$/, ''); // drop trailing dots/underscores

    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    if (!username) {
      nodes.push('@' + raw); // nothing left after stripping → keep literal
    } else {
      nodes.push(
        <Link
          key={`m${key++}`}
          to={`/users/${username}`}
          className="font-medium text-primary hover:underline"
        >
          @{username}
        </Link>,
      );
      const trailing = raw.slice(username.length);
      if (trailing) nodes.push(trailing);
    }

    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
