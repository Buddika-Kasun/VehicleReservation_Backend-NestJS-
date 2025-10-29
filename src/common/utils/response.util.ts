export const success = (data: any) => ({ success: true, data });
export const failure = (message: string) => ({ success: false, message });
