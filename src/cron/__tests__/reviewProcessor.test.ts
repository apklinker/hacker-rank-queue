import { Deadline } from '@/bot/enums';
import { ActiveReview, PendingReviewer } from '@/database/models/ActiveReview';
import { activeReviewRepo } from '@/database/repos/activeReviewsRepo';
import { RequestService } from '@/services';
import { App } from '@slack/bolt';
import { reviewProcessor } from '../reviewProcessor';
import { mocked } from 'ts-jest/utils';

Date.now = jest.fn();
const nowMock = mocked(Date.now);
nowMock.mockReturnValue(1000000);

function mockReview(pendingReviewers: PendingReviewer[]): ActiveReview {
  return {
    threadId: Symbol('thread-id-' + Math.random()) as any,
    acceptedReviewers: [],
    dueBy: Deadline.NONE,
    languages: [],
    pendingReviewers,
    requestedAt: new Date(),
    requestorId: 'some-id',
    reviewersNeededCount: 2,
  };
}

function mockPendingReviewer(dateOffsetMs: number): PendingReviewer {
  return {
    userId: Symbol('some-user-' + Math.random()) as any,
    expiresAt: Date.now() + dateOffsetMs,
  };
}

describe('Review Processor', () => {
  let declineRequest: jest.Mock;
  let app: App;

  const reviewer11 = mockPendingReviewer(+1);
  const reviewer12 = mockPendingReviewer(-10);
  const review1 = mockReview([reviewer11, reviewer12]);

  const reviewer21 = mockPendingReviewer(+50);
  const reviewer22 = mockPendingReviewer(+1);
  const review2 = mockReview([reviewer21, reviewer22]);

  const reviewer31 = mockPendingReviewer(-1000);
  const reviewer32 = mockPendingReviewer(-1);
  const reviewer33 = mockPendingReviewer(-5);
  const review3 = mockReview([reviewer31, reviewer32, reviewer33]);

  const reviewer41 = mockPendingReviewer(0);
  const review4 = mockReview([reviewer41]);

  const mockError = Error('mock error');

  beforeEach(async () => {
    jest.resetAllMocks();
    process.env.ERRORS_CHANNEL_ID = 'some-errors-channel';
    nowMock.mockReturnValue(1000000);
    app = {
      client: {
        chat: {
          postMessage: jest.fn() as any,
        },
      },
    } as App;
    declineRequest = RequestService.declineRequest = jest.fn();
    declineRequest
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    activeReviewRepo.listAll = jest.fn().mockResolvedValue([review1, review2, review3, review4]);

    await reviewProcessor(app);
  });

  it('should check all the reviews', () => {
    expect(activeReviewRepo.listAll).toBeCalled();
  });

  it('should decline only the requests that failed', () => {
    expect(declineRequest).toBeCalledWith(expect.anything(), review1, reviewer12.userId);
    expect(declineRequest).toBeCalledWith(expect.anything(), review3, reviewer31.userId);
    expect(declineRequest).toBeCalledWith(expect.anything(), review3, reviewer32.userId);
    expect(declineRequest).toBeCalledWith(expect.anything(), review3, reviewer33.userId);
  });

  it('should not expire requests that expire on this exact millisecond, give the user a little be more time for being so lucky', () => {
    expect(declineRequest).not.toBeCalledWith(
      expect.anything(),
      expect.anything(),
      reviewer41.userId,
    );
  });

  it('should not stop when a single request fails', () => {
    expect(declineRequest).toBeCalledTimes(4);
  });

  it('should notify the errors channel when there is a failure', () => {
    expect(app.client.chat.postMessage).toBeCalledTimes(1);
    expect(app.client.chat.postMessage).toBeCalledWith(
      expect.objectContaining({
        channel: process.env.ERRORS_CHANNEL_ID,
        text: expect.stringContaining(mockError.message),
      }),
    );
  });
});
