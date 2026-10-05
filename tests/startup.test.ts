import type { AddressInfo } from 'node:net';
import { UPSTREAMS, start } from '../src/index';

describe('startup configuration check', () => {
  const saved = { url: process.env.CORE_API_URL, port: process.env.CORE_API_PORT };
  afterEach(() => {
    process.env.CORE_API_URL = saved.url;
    process.env.CORE_API_PORT = saved.port;
    if (saved.url === undefined) delete process.env.CORE_API_URL;
    if (saved.port === undefined) delete process.env.CORE_API_PORT;
  });

  test('checks every upstream the BFF calls', () => {
    expect(UPSTREAMS).toEqual(['CORE_API']);
  });

  test('refuses to start without CORE_API_URL instead of falling back to localhost', () => {
    delete process.env.CORE_API_URL;

    expect(() => start(0)).toThrow('Missing or invalid upstream configuration: CORE_API_URL');
  });

  test('refuses to start with an invalid CORE_API_PORT', () => {
    process.env.CORE_API_URL = 'core';
    process.env.CORE_API_PORT = 'not-a-port';

    expect(() => start(0)).toThrow('CORE_API_URL');
  });

  test('listens once every upstream is configured', async () => {
    process.env.CORE_API_URL = 'http://core:3000';
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const server = start(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));

    expect((server.address() as AddressInfo).port).toBeGreaterThan(0);
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  test('listens on PORT when no port is given', async () => {
    process.env.CORE_API_URL = 'http://core:3000';
    const savedPort = process.env.PORT;
    process.env.PORT = '0';
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const server = start();
      await new Promise<void>((resolve) => server.once('listening', resolve));

      expect((server.address() as AddressInfo).port).toBeGreaterThan(0);
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    } finally {
      if (savedPort === undefined) delete process.env.PORT;
      else process.env.PORT = savedPort;
    }
  });
});
