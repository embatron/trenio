export type TelegramWidgetUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  /** Present only when Telegram puts it in the signed widget payload. */
  phone_number?: string;
  auth_date: number;
  hash: string;
};
