"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCommentAction, deleteCommentAction } from "@/app/actions/quests";
import { PlayerDisc } from "@/components/game/PlayerDisc";
import { Button } from "@/components/ui/Button";
import type { PlayerColorKey } from "@/lib/colors";

export type CommentView = { id: string; name: string; color: PlayerColorKey | null; body: string; when: string; canDelete: boolean };

export function Comments({ questId, comments, canComment }: { questId: string; comments: CommentView[]; canComment: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section id="comments" aria-labelledby="comments-h" className="mt-3 rounded-2xl bg-panel py-1.5">
      <h2 id="comments-h" className="m-0 px-4 pb-1 pt-2.5 text-[15px] font-bold">
        Comments
      </h2>
      {comments.length ? (
        <ul className="m-0 list-none p-0">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3 border-t border-panel-rule px-4 py-3">
              <PlayerDisc player={{ name: c.name, color: c.color }} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-bold">{c.name}</span> <span className="text-xs text-muted">{c.when}</span>
                </div>
                <p className="m-0 mt-0.5 whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
              {c.canDelete ? (
                <button type="button" className="self-start text-xs font-bold text-muted hover:text-danger" onClick={() => start(async () => { await deleteCommentAction(c.id); router.refresh(); })}>
                  Delete
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 border-t border-panel-rule px-4 py-3 text-sm text-muted">No comments yet.</p>
      )}
      {canComment ? (
        <form
          className="flex gap-2 border-t border-panel-rule px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await addCommentAction(questId, body);
              if (!res.ok) setError(res.error);
              else {
                setBody("");
                setError(null);
                router.refresh();
              }
            });
          }}
        >
          <label className="sr-only" htmlFor="comment-body">
            Add a comment
          </label>
          <input id="comment-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Add a comment" className="h-11 min-w-0 flex-1 rounded-xl bg-sea px-3 text-sm text-text placeholder:text-muted" />
          <Button type="submit" size="md" disabled={pending || !body.trim()}>
            Post
          </Button>
        </form>
      ) : null}
      {error ? <p role="alert" className="m-0 px-4 pb-2 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
