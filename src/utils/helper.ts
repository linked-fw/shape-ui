// currently use for generate
export function generateRandomName(format: string) {
  const timestamp = new Date().getTime();
  const randomString = Math.random().toString(15).substring(7); // Generate a random string

  return format
    ? `${timestamp}_${randomString}.${format}`
    : `${timestamp}_${randomString}`;
}
