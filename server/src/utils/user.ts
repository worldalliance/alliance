/** @fileoverview Utils for users */
import { User } from 'src/user/entities/user.entity';
import { findLeast } from './filter';
import { ContractEventType } from 'src/user/entities/contract-event.entity';

export function computeIsContractActiveInFullRange(params: {
  user: Pick<User, 'contractEvents'>;
  startDate?: Date | null;
  endDate?: Date | null;
}): boolean {
  const { user, startDate, endDate } = params;
  const events = user.contractEvents ?? [];
  const startDateTime = startDate?.getTime() ?? -Infinity;
  const endDateTime = endDate?.getTime() ?? Infinity;

  const startingContractStatus =
    findLeast(
      events,
      (a, b) => b.date.getTime() - a.date.getTime(), // reverse order
      (event) => event.date.getTime() <= startDateTime,
    )?.type ?? ContractEventType.SUSPENDED;

  if (startingContractStatus === ContractEventType.SUSPENDED) {
    // Check if range is non-empty
    return startDateTime >= endDateTime;
  }

  return !events.some((event) => {
    const eventTime = event.date.getTime();
    return (
      startDateTime <= eventTime &&
      eventTime < endDateTime &&
      event.type === ContractEventType.SUSPENDED
    );
  });
}

export function computeIsAwayInRange(params: {
  user: Pick<User, 'awayRanges'>;
  startDate?: Date | null;
  endDate?: Date | null;
}): boolean {
  const { user, startDate, endDate } = params;
  return user.awayRanges.some(
    (awayRange) =>
      !(
        (endDate && endDate <= awayRange.startDate) ||
        (startDate && startDate >= awayRange.endDate)
      ),
  );
}
