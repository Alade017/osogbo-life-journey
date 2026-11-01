import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Paperclip, FileText, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  MEDIA_ACCEPT,
  socialMediaRequest,
  uploadSocialMedia,
  validateMedia,
  type MessageAttachment,
  type SocialProfileCard,
} from "@/lib/social-media";
import { Avatar, type Appearance } from "@/components/game/Avatar";

const layer = { zIndex: "calc(var(--game-dialog-layer, 100) + 15)" };
function usePreview(file: File | null) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file || file.type === "application/pdf") {
      setUrl(undefined);
      return;
    }
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return url;
}
export function ComposerMedia({
  threadId,
  disabled,
  onSent,
}: {
  threadId: string;
  disabled?: boolean;
  onSent: () => void;
}) {
  const picker = useRef<HTMLInputElement>(null),
    cameraPicker = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState(false),
    [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState(""),
    [sending, setSending] = useState(false);
  const key = useRef(""),
    busy = useRef(false);
  const preview = usePreview(file);
  const stop = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  useEffect(() => () => stop(), []);
  useEffect(() => {
    if (camera && video.current && stream.current) video.current.srcObject = stream.current;
  }, [camera]);
  function select(value?: File) {
    if (!value) return;
    try {
      validateMedia(value);
      setFile(value);
      key.current = crypto.randomUUID();
      setError("");
      cameraRequested.current = false;
      cameraGeneration.current += 1;
      stop();
      setCamera(false);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  async function openCamera() {
    const generation = ++cameraGeneration.current;
    setError("");
    setCamera(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Camera is unavailable here. Choose a photo instead.");
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      // A late permission response must not keep the camera running after dismissal.
      if (!cameraRequested.current || generation !== cameraGeneration.current) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      stop();
      stream.current = next;
      if (video.current) video.current.srcObject = next;
    } catch {
      if (cameraRequested.current && generation === cameraGeneration.current)
        setError("Camera could not be opened. Allow camera access or choose a photo instead.");
    }
  }
  const cameraRequested = useRef(false);
  const cameraGeneration = useRef(0);
  useEffect(
    () => () => {
      cameraRequested.current = false;
      cameraGeneration.current += 1;
    },
    [],
  );
  function dismiss() {
    if (busy.current) return;
    cameraRequested.current = false;
    cameraGeneration.current += 1;
    stop();
    setCamera(false);
    setFile(null);
    setError("");
  }
  async function capture() {
    const generation = cameraGeneration.current;
    const source = video.current;
    if (!source?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob && cameraRequested.current && generation === cameraGeneration.current)
          select(new File([blob], "camera-photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  }
  async function send() {
    if (!file || busy.current || disabled) return;
    busy.current = true;
    setSending(true);
    setError("");
    try {
      await uploadSocialMedia(file, key.current, threadId);
      setFile(null);
      onSent();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  return (
    <>
      <input
        ref={picker}
        type="file"
        accept={MEDIA_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose attachment"
        onChange={(event) => {
          select(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraPicker}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose camera photo"
        onChange={(event) => {
          select(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="phone-chat-utility"
        aria-label="Attach file"
        disabled={disabled || sending}
        onClick={() => picker.current?.click()}
      >
        <Paperclip size={18} />
      </button>
      <button
        type="button"
        className="phone-chat-utility"
        aria-label="Open camera"
        disabled={disabled || sending}
        onClick={() => {
          if (cameraRequested.current) return;
          cameraRequested.current = true;
          void openCamera();
        }}
      >
        <Camera size={18} />
      </button>
      {error && !camera && !file && (
        <span role="alert" className="chat-media-error">
          {error}
        </span>
      )}
      <Dialog
        open={camera || !!file}
        onOpenChange={(open) => {
          if (!open) dismiss();
        }}
      >
        <DialogContent className="chat-media-dialog" style={layer}>
          <DialogTitle>{file ? "Preview attachment" : "Camera"}</DialogTitle>
          <DialogDescription>
            Images and PDF files up to 10 MB. Only conversation participants can open sent files.
          </DialogDescription>
          {file ? (
            <>
              {preview ? (
                <img className="chat-media-preview" src={preview} alt="Attachment preview" />
              ) : (
                <FileText size={40} aria-hidden="true" />
              )}
              <p className="break-words">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
              <button
                type="button"
                className="chat-primary-button"
                disabled={sending || disabled}
                onClick={() => void send()}
              >
                {sending ? "Sending…" : error ? "Retry attachment" : "Send attachment"}
              </button>
            </>
          ) : (
            <>
              <video
                ref={video}
                autoPlay
                muted
                playsInline
                className="chat-media-preview"
                aria-label="Camera preview"
              />
              <button type="button" className="chat-primary-button" onClick={() => void capture()}>
                Take photo
              </button>
              <button
                type="button"
                className="chat-secondary-button"
                onClick={() => cameraPicker.current?.click()}
              >
                Choose photo
              </button>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <button
            type="button"
            className="chat-secondary-button"
            disabled={sending}
            onClick={dismiss}
          >
            Cancel
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AttachmentMessage({
  messageId,
  attachment,
  ownerId,
}: {
  messageId: string;
  attachment: MessageAttachment;
  ownerId?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const query = useQuery<{ url: string }>({
    queryKey: ["messageAttachment", ownerId, messageId],
    enabled: open,
    queryFn: () => socialMediaRequest(`/api/messages/media/${messageId}`),
    staleTime: 0,
    retry: false,
    refetchInterval: open ? 45000 : false,
  });
  return (
    <>
      <button
        type="button"
        className="chat-attachment"
        onClick={() => {
          setImageError(false);
          setOpen(true);
        }}
      >
        {attachment.mimeType === "application/pdf" ? (
          <FileText aria-hidden="true" />
        ) : (
          <ImageIcon aria-hidden="true" />
        )}
        <span>
          <strong>{attachment.filename}</strong>
          <small>
            {attachment.mimeType === "application/pdf" ? "PDF" : "Photo"} ·{" "}
            {Math.ceil(attachment.size / 1024)} KB · Open
          </small>
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="chat-media-dialog" style={layer}>
          <DialogTitle>{attachment.filename}</DialogTitle>
          <DialogDescription>Shared in this conversation.</DialogDescription>
          {query.isFetching ? (
            <p role="status">Opening attachment…</p>
          ) : query.isError ? (
            <p role="alert">
              This attachment is unavailable.{" "}
              <button type="button" onClick={() => void query.refetch()}>
                Try again
              </button>
            </p>
          ) : (
            query.data && (
              <>
                {attachment.mimeType !== "application/pdf" &&
                  (imageError ? (
                    <p role="alert">
                      Photo preview could not be loaded.{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setImageError(false);
                          void query.refetch();
                        }}
                      >
                        Refresh photo
                      </button>
                    </p>
                  ) : (
                    <img
                      className="chat-media-preview"
                      src={query.data.url}
                      alt={attachment.filename}
                      onError={() => setImageError(true)}
                    />
                  ))}
                <a
                  href={query.data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chat-primary-button"
                >
                  {attachment.mimeType === "application/pdf" ? "Download PDF" : "Open photo"}
                </a>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PlayerSocialCard({
  characterId,
  ownerId,
  onClose,
}: {
  characterId: string;
  ownerId: string;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const busy = useRef(false),
    key = useRef("");
  const preview = usePreview(file);
  const query = useQuery<SocialProfileCard>({
    queryKey: ["socialProfileCard", ownerId, characterId],
    queryFn: () => socialMediaRequest(`/api/social/profile/${characterId}`),
    retry: false,
    staleTime: 0,
    refetchInterval: 30000,
  });
  async function save() {
    if (!file || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await uploadSocialMedia(file, key.current);
      setFile(null);
      await query.refetch();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const card = query.data;
  async function removeCover() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await socialMediaRequest(`/api/social/profile/${characterId}`, { method: "DELETE" });
      setFile(null);
      await query.refetch();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy.current) onClose();
      }}
    >
      <DialogContent className="chat-profile-card" style={layer}>
        <DialogTitle>{card?.name ?? "Player profile"}</DialogTitle>
        <DialogDescription>
          Character profile · covers and active statuses are shared with friends.
        </DialogDescription>
        {query.isPending ? (
          <p role="status">Loading player…</p>
        ) : query.isError ? (
          <p role="alert">
            This profile is unavailable.{" "}
            <button type="button" onClick={() => void query.refetch()}>
              Try again
            </button>
          </p>
        ) : (
          card && (
            <>
              <div className="chat-profile-cover">
                {preview || card.coverUrl ? (
                  <img src={preview ?? card.coverUrl!} alt={`${card.name}'s shared background`} />
                ) : (
                  <span>No shared background image</span>
                )}
              </div>
              <div className="chat-profile-identity">
                <Avatar gender={card.gender} appearance={card.appearance as Appearance} size={72} />
                <div>
                  <strong>{card.name}</strong>
                  <p>
                    Level {card.level} ·{" "}
                    {card.isOwn ? "Your character" : card.isFriend ? "Friend" : "Player"}
                  </p>
                </div>
              </div>
              {card.status ? (
                <article
                  className={`phone-status-card status-theme-${["porcelain", "leaf", "ink", "sunset"].includes(card.status.theme) ? card.status.theme : "porcelain"}`}
                >
                  <strong>Current status</strong>
                  <p>{card.status.body}</p>
                </article>
              ) : (
                <p>No active status shared with you.</p>
              )}
              {card.isOwn && (
                <div className="chat-cover-editor">
                  {card.coverUrl && (
                    <button
                      type="button"
                      className="chat-secondary-button"
                      disabled={saving}
                      onClick={() => void removeCover()}
                    >
                      Remove background image
                    </button>
                  )}
                  <label>
                    Change background image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={saving}
                      onChange={(event) => {
                        const next = event.target.files?.[0];
                        event.target.value = "";
                        if (!next) return;
                        try {
                          validateMedia(next, true);
                          setFile(next);
                          key.current = crypto.randomUUID();
                          setError("");
                        } catch (cause) {
                          setError((cause as Error).message);
                        }
                      }}
                    />
                  </label>
                  {file && (
                    <>
                      <button
                        type="button"
                        className="chat-primary-button"
                        disabled={saving}
                        onClick={() => void save()}
                      >
                        {saving ? "Saving…" : "Save background"}
                      </button>
                      <button
                        type="button"
                        className="chat-secondary-button"
                        disabled={saving}
                        onClick={() => setFile(null)}
                      >
                        Discard
                      </button>
                    </>
                  )}
                </div>
              )}
              {error && <p role="alert">{error}</p>}
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
