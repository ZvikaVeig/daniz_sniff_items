const COMPLIMENT_GREETINGS = [
  { text: "היי דני המהממת", emoji: "✨👑💎" },
  { text: "היי דני היפה", emoji: "🌸💖🌹" },
  { text: "היי דני הכוסית", emoji: "🔥💃✨" },
  { text: "היי דני השווה", emoji: "💎👑🌟" },
  { text: "היי דני המוכשרת", emoji: "🌟💼✨" },
  { text: "היי דני המטורפת על", emoji: "🚀🔥💖" },
  { text: "היי דני אשת העסקים", emoji: "💼👜📈" },
  { text: "היי אשתו היפה של צביקה", emoji: "💑💕👑" },
] as const;

export function getRandomComplimentGreeting(): string {
  const index = Math.floor(Math.random() * COMPLIMENT_GREETINGS.length);
  const { text, emoji } = COMPLIMENT_GREETINGS[index];
  return `${text} ${emoji}`;
}

export function withComplimentGreeting(body: string): string {
  return `${getRandomComplimentGreeting()}\n\n${body.trim()}`;
}
