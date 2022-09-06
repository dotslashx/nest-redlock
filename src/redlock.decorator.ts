import { Inject } from "@nestjs/common";
import { RedlockAbortSignal, Settings } from "redlock";
import { DEFAULT_DURATION } from "./redlock.constants";
import { RedLockKeyFunction } from "./redlock.interface";
import { RedlockService } from "./redlock.service";

export function Redlock<T extends (...args: any) => any = (...args: any) => any>(
  key: string | string[] | RedLockKeyFunction<T>,
  duration?: number,
  settings: Partial<Settings> = {},
): MethodDecorator {
  const injectRedlockService = Inject(RedlockService);

  return (target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
    const serviceSymbol = "@redlockService";

    injectRedlockService(target, serviceSymbol);

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const descriptorThis = this;
      const redlockService = (descriptorThis as any)[serviceSymbol] as RedlockService;

      const keys = getKeys(key, descriptorThis, args);

      return await redlockService.using(
        keys,
        duration || redlockService.options?.duration || DEFAULT_DURATION,
        settings,
        async (signal: RedlockAbortSignal) => {
          const result = await originalMethod.apply(descriptorThis, args);

          if (signal.aborted) {
            throw signal.error;
          }

          return result;
        },
      );
    };
    return descriptor;
  };
}

function getKeys(
  key: string | string[] | RedLockKeyFunction,
  descriptorThis: TypedPropertyDescriptor<any>,
  args: any[],
): string[] {
  if (typeof key === "string") {
    return [key];
  } else if (Array.isArray(key)) {
    return key;
  } else if (typeof key === "function") {
    return [key(descriptorThis, ...args)].flat();
  }

  return [];
}
