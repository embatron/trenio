declare module "web-push" {
  type Subscription = {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(subscription: Subscription, payload?: string): Promise<{ statusCode: number }>;
    generateVAPIDKeys(): { publicKey: string; privateKey: string };
  };

  export default webpush;
}
