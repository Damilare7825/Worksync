export class BaseEmailProvider {
  async send(_payload) {
    throw new Error('send() must be implemented by provider');
  }
}
