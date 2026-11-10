import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut, Plus, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createSocialGroup,
  fetchSocialGroupMessages,
  fetchSocialGroups,
  leaveSocialGroup,
  sendSocialGroupMessage,
  type SocialGroup,
} from "@/lib/social-groups";

export type GroupFriend = { character_id: string; player_name: string };

type GroupView = { kind: "list" } | { kind: "create" } | { kind: "thread"; groupId: string };

const MAX_GROUP_MEMBERS = 8;
const MAX_GROUP_NAME = 40;
const MAX_GROUP_MESSAGE = 500;

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
  const groupsQuery = useQuery({ queryKey: ["socialGroups"], queryFn: fetchSocialGroups });
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
            <li key={group.id}>
              <button type="button" className="phone-group-card" onClick={() => onOpen(group.id)}>
                <span className="phone-group-icon" aria-hidden="true">
                  <Users size={18} />
                </span>
                <span className="phone-group-copy">
                  <strong>{group.name}</strong>
                  <small>{group.lastBody ?? `${group.memberCount} members`}</small>
                </span>
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

function GroupThread({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const groupsQuery = useQuery({ queryKey: ["socialGroups"], queryFn: fetchSocialGroups });
  const group: SocialGroup | undefined = groupsQuery.data?.find((item) => item.id === groupId);
  const messagesQuery = useQuery({
    queryKey: ["socialGroupMessages", groupId],
    queryFn: () => fetchSocialGroupMessages(groupId),
    refetchInterval: 8000,
  });

  const send = useMutation({
    mutationFn: (body: string) => sendSocialGroupMessage(groupId, body, crypto.randomUUID()),
    onSuccess: async () => {
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["socialGroupMessages", groupId] });
      await queryClient.invalidateQueries({ queryKey: ["socialGroups"] });
    },
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
              <p>{message.body}</p>
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
        <input
          value={draft}
          maxLength={MAX_GROUP_MESSAGE}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message the group"
          aria-label="Message the group"
        />
        <button type="submit" disabled={!body || send.isPending} aria-label="Send message">
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
