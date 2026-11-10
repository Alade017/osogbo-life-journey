import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BellOff, ImagePlus, LogOut, Pin, Plus, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VoiceNotePlayer, VoiceNoteRecorder } from "@/components/game/VoiceNotes";
import { MEDIA_MAX_BYTES } from "@/lib/social-media";
import {
  GROUP_REACTIONS,
  createSocialGroup,
  fetchSocialGroupMessages,
  fetchSocialGroups,
  getGroupMediaUrl,
  leaveSocialGroup,
  sendGroupPicture,
  sendGroupVoice,
  sendSocialGroupMessage,
  setGroupPrefs,
  toggleGroupReaction,
  type GroupReaction,
  type SocialGroup,
  type SocialGroupMessage,
} from "@/lib/social-groups";

export type GroupFriend = { character_id: string; player_name: string };

type GroupView = { kind: "list" } | { kind: "create" } | { kind: "thread"; groupId: string };

const MAX_GROUP_MEMBERS = 8;
const MAX_GROUP_NAME = 40;
const MAX_GROUP_MESSAGE = 500;
const PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

/** Group chats for the messages inbox: the Groups filter shows this instead of private chats. */
export function GroupChats({ friends }: { friends: GroupFriend[] }) {
  const [view, setView] = useState<GroupView>({ kind: "list" });
  if (view.kind === "create") {
    return (
      <CreateGroup
        friends={friends}
        onBack={() => setView({ kind: "list" })}
        onCreated={(groupId) => setView({ kind: "thread", groupId })}
      />
    );
  }
  if (view.kind === "thread") {
    return <GroupThread groupId={view.groupId} onBack={() => setView({ kind: "list" })} />;
  }
  return (
    <GroupList
      onNew={() => setView({ kind: "create" })}
      onOpen={(groupId) => setView({ kind: "thread", groupId })}
    />
  );
}

function GroupList({ onNew, onOpen }: { onNew: () => void; onOpen: (groupId: string) => void }) {
  const queryClient = useQueryClient();
  const groupsQuery = useQuery({ queryKey: ["socialGroups"], queryFn: fetchSocialGroups });
  const prefs = useMutation({
    mutationFn: (input: { group: SocialGroup; pinned: boolean; muted: boolean }) =>
      setGroupPrefs(input.group.id, input.pinned, input.muted),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["socialGroups"] }),
    onError: (error) => toast.error(errorText(error)),
  });

  return (
    <section className="phone-group-panel" aria-label="Group chats">
      <div className="phone-group-heading">
        <h3>Groups</h3>
        <button
          type="button"
          className="phone-new-message-button"
          onClick={onNew}
          aria-label="New group"
        >
          <Plus size={19} />
        </button>
      </div>
      {groupsQuery.isPending ? (
        <p className="phone-inbox-state">Loading your groups…</p>
      ) : groupsQuery.error ? (
        <p className="phone-inbox-state" role="alert">
          {errorText(groupsQuery.error)}
        </p>
      ) : groupsQuery.data.length ? (
        <ul className="phone-group-list">
          {groupsQuery.data.map((group) => (
            <li key={group.id} className="phone-group-row">
              <button type="button" className="phone-group-card" onClick={() => onOpen(group.id)}>
                <span className="phone-group-icon" aria-hidden="true">
                  <Users size={18} />
                </span>
                <span className="phone-group-copy">
                  <strong>
                    {group.name}
                    {group.muted && <BellOff size={12} aria-label="Muted" />}
                  </strong>
                  <small>{group.lastBody ?? `${group.memberCount} members`}</small>
                </span>
              </button>
              <button
                type="button"
                className={group.pinned ? "phone-group-tool is-on" : "phone-group-tool"}
                aria-pressed={group.pinned}
                aria-label={group.pinned ? `Unpin ${group.name}` : `Pin ${group.name}`}
                onClick={() => prefs.mutate({ group, pinned: !group.pinned, muted: group.muted })}
                disabled={prefs.isPending}
              >
                <Pin size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={group.muted ? "phone-group-tool is-on" : "phone-group-tool"}
                aria-pressed={group.muted}
                aria-label={group.muted ? `Unmute ${group.name}` : `Mute ${group.name}`}
                onClick={() => prefs.mutate({ group, pinned: group.pinned, muted: !group.muted })}
                disabled={prefs.isPending}
              >
                <BellOff size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="phone-inbox-state">
          No groups yet. Start one with your friends using the + button.
        </p>
      )}
    </section>
  );
}

function CreateGroup({
  friends,
  onBack,
  onCreated,
}: {
  friends: GroupFriend[];
  onBack: () => void;
  onCreated: (groupId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const canCreate = name.trim().length > 0 && selected.length >= 1;

  const create = useMutation({
    mutationFn: () => createSocialGroup(name.trim(), selected),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["socialGroups"] });
      const id =
        typeof result === "object" && result !== null && "id" in result
          ? String((result as { id: unknown }).id)
          : null;
      toast.success("Group created");
      if (id) onCreated(id);
      else onBack();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  function toggle(characterId: string) {
    setSelected((current) =>
      current.includes(characterId)
        ? current.filter((id) => id !== characterId)
        : current.length >= MAX_GROUP_MEMBERS - 1
          ? current
          : [...current, characterId],
    );
  }

  return (
    <section className="phone-group-panel" aria-label="New group">
      <div className="phone-group-heading">
        <button type="button" className="phone-back-button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Groups
        </button>
      </div>
      <h3 className="phone-group-title">New group</h3>
      <label className="phone-group-field">
        <span>Group name</span>
        <input
          value={name}
          maxLength={MAX_GROUP_NAME}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name your group"
        />
      </label>
      <fieldset className="phone-group-friends">
        <legend>Add friends (up to {MAX_GROUP_MEMBERS - 1})</legend>
        {friends.length ? (
          friends.map((friend) => (
            <label key={friend.character_id} className="phone-group-friend">
              <input
                type="checkbox"
                checked={selected.includes(friend.character_id)}
                onChange={() => toggle(friend.character_id)}
              />
              <span>{friend.player_name}</span>
            </label>
          ))
        ) : (
          <p className="phone-inbox-state">Add friends first to start a group.</p>
        )}
      </fieldset>
      <Button
        type="button"
        className="phone-group-primary"
        disabled={!canCreate || create.isPending}
        onClick={() => create.mutate()}
      >
        {create.isPending ? "Creating…" : "Create group"}
      </Button>
    </section>
  );
}

function GroupPicture({ messageId }: { messageId: string }) {
  const link = useQuery({
    queryKey: ["groupMediaUrl", messageId],
    queryFn: () => getGroupMediaUrl(messageId),
    staleTime: 4 * 60 * 1000,
  });
  if (link.error) return <p className="phone-inbox-state">Picture unavailable.</p>;
  if (!link.data) return <p className="phone-inbox-state">Loading picture…</p>;
  return <img className="phone-group-picture" src={link.data} alt="Picture shared in the group" />;
}

function GroupReactions({
  message,
  onToggle,
  busy,
}: {
  message: SocialGroupMessage;
  onToggle: (emoji: GroupReaction) => void;
  busy: boolean;
}) {
  return (
    <div className="phone-group-reactions" role="group" aria-label="Reactions">
      {GROUP_REACTIONS.map((emoji) => {
        const summary = message.reactions.find((item) => item.emoji === emoji);
        const mine = summary?.mine ?? false;
        return (
          <button
            key={emoji}
            type="button"
            className={mine ? "is-mine" : undefined}
            aria-pressed={mine}
            aria-label={`React ${emoji}${summary ? `, ${summary.count}` : ""}`}
            onClick={() => onToggle(emoji)}
            disabled={busy}
          >
            <span aria-hidden="true">{emoji}</span>
            {summary && summary.count > 0 && <b>{summary.count}</b>}
          </button>
        );
      })}
    </div>
  );
}

function GroupThread({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const pictureInput = useRef<HTMLInputElement>(null);
  const groupsQuery = useQuery({ queryKey: ["socialGroups"], queryFn: fetchSocialGroups });
  const group: SocialGroup | undefined = groupsQuery.data?.find((item) => item.id === groupId);
  const messagesQuery = useQuery({
    queryKey: ["socialGroupMessages", groupId],
    queryFn: () => fetchSocialGroupMessages(groupId),
    refetchInterval: 8000,
  });

  async function refreshMessages() {
    await queryClient.invalidateQueries({ queryKey: ["socialGroupMessages", groupId] });
    await queryClient.invalidateQueries({ queryKey: ["socialGroups"] });
  }

  const send = useMutation({
    mutationFn: (body: string) => sendSocialGroupMessage(groupId, body, crypto.randomUUID()),
    onSuccess: async () => {
      setDraft("");
      await refreshMessages();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const picture = useMutation({
    mutationFn: (file: File) => sendGroupPicture({ groupId, file, requestId: crypto.randomUUID() }),
    onSuccess: refreshMessages,
    onError: (error) => toast.error(errorText(error)),
  });

  const react = useMutation({
    mutationFn: (input: { messageId: string; emoji: GroupReaction }) =>
      toggleGroupReaction(input.messageId, input.emoji),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["socialGroupMessages", groupId] }),
    onError: (error) => toast.error(errorText(error)),
  });

  const leave = useMutation({
    mutationFn: () => leaveSocialGroup(groupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["socialGroups"] });
      toast.success("You left the group");
      onBack();
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const body = draft.trim();
  return (
    <section className="phone-group-panel phone-group-thread" aria-label={group?.name ?? "Group"}>
      <div className="phone-group-heading">
        <button type="button" className="phone-back-button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Groups
        </button>
        <button
          type="button"
          className="phone-group-leave"
          onClick={() => leave.mutate()}
          disabled={leave.isPending}
          aria-label="Leave group"
        >
          <LogOut size={15} aria-hidden="true" />
        </button>
      </div>
      <h3 className="phone-group-title">{group?.name ?? "Group"}</h3>
      {group && <p className="phone-group-members">{group.memberNames.join(", ")}</p>}
      <div className="phone-group-messages" role="log" aria-live="polite">
        {messagesQuery.isPending ? (
          <p className="phone-inbox-state">Loading messages…</p>
        ) : messagesQuery.error ? (
          <p className="phone-inbox-state" role="alert">
            {errorText(messagesQuery.error)}
          </p>
        ) : messagesQuery.data.length ? (
          messagesQuery.data.map((message) => (
            <div key={message.id} className="phone-group-message">
              <strong>{message.senderName}</strong>
              {message.kind === "text" && <p>{message.body}</p>}
              {message.kind === "voice" && (
                <VoiceNotePlayer
                  messageId={message.id}
                  durationMs={message.durationMs ?? 1000}
                  loadUrl={getGroupMediaUrl}
                />
              )}
              {message.kind === "image" && <GroupPicture messageId={message.id} />}
              <GroupReactions
                message={message}
                busy={react.isPending}
                onToggle={(emoji) => react.mutate({ messageId: message.id, emoji })}
              />
            </div>
          ))
        ) : (
          <p className="phone-inbox-state">No messages yet. Say hello.</p>
        )}
      </div>
      <form
        className="phone-group-composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (body && !send.isPending) send.mutate(body);
        }}
      >
        <button
          type="button"
          className="phone-group-attach"
          onClick={() => pictureInput.current?.click()}
          disabled={picture.isPending}
          aria-label="Send a picture"
        >
          <ImagePlus size={16} aria-hidden="true" />
        </button>
        <input
          ref={pictureInput}
          type="file"
          accept={PICTURE_TYPES.join(",")}
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (!PICTURE_TYPES.includes(file.type)) {
              toast.error("Pictures must be JPEG, PNG or WebP.");
              return;
            }
            if (file.size > MEDIA_MAX_BYTES) {
              toast.error("Pictures must be 10 MB or smaller.");
              return;
            }
            picture.mutate(file);
          }}
        />
        <input
          value={draft}
          maxLength={MAX_GROUP_MESSAGE}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message the group"
          aria-label="Message the group"
        />
        <VoiceNoteRecorder
          upload={({ blob, durationMs, requestId }) =>
            sendGroupVoice({ groupId, blob, durationMs, requestId })
          }
          onSent={() => void refreshMessages()}
        />
        <button type="submit" disabled={!body || send.isPending} aria-label="Send message">
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
