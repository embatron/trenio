import EmojiPicker from "emoji-picker-react";

export default function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <EmojiPicker
      emojiData={() => import("emoji-picker-react/data/emojis-ru")}
      onEmojiClick={(emoji) => onPick(emoji.emoji)}
      previewConfig={{ showPreview: false }}
      searchPlaceholder="Поиск"
      searchPlaceHolder="Поиск"
      searchLabel="Поиск"
      width="100%"
      height={360}
      lazyLoadEmojis
    />
  );
}
