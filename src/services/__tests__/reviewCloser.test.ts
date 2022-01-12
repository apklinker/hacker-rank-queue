import { activeReviewRepo } from '@repos/activeReviewsRepo';
import { chatService } from '@/services/ChatService';
import { ActiveReview } from '@models/ActiveReview';
import { Deadline } from '@bot/enums';
import { App } from '@slack/bolt';
import { buildMockApp } from '@utils/slackMocks';
import { reviewCloser } from '@/services/ReviewCloser';

describe('reviewCloser', () => {
  let app: App;
  beforeEach(() => {
    app = buildMockApp();
    chatService.replyToReviewThread = jest.fn().mockResolvedValue(undefined);
    activeReviewRepo.remove = jest.fn().mockResolvedValue(undefined);
  });

  describe('closeReviewIfComplete', () => {
    it('should close a completed review', async () => {
      const threadId = '111';
      const requestorId = '123';
      const review: ActiveReview = {
        threadId: threadId,
        requestorId: requestorId,
        languages: ['Java'],
        requestedAt: new Date(),
        dueBy: Deadline.MONDAY,
        reviewersNeededCount: 2,
        acceptedReviewers: ['A', 'B'],
        declinedReviewers: [],
        pendingReviewers: [],
      };
      activeReviewRepo.getReviewByThreadIdOrFail = jest.fn().mockResolvedValue(review);

      await reviewCloser.closeReviewIfComplete(app, threadId);

      expect(chatService.replyToReviewThread).toHaveBeenCalledWith(
        app.client,
        threadId,
        `<@${requestorId}> all 2 reviewers have been found!`,
      );
      expect(activeReviewRepo.remove).toHaveBeenCalledWith(threadId);
    });

    it('should close unfulfilled reviews', async () => {
      const threadId = '111';
      const requestorId = '123';
      const review: ActiveReview = {
        threadId: threadId,
        requestorId: requestorId,
        languages: ['Java'],
        requestedAt: new Date(),
        dueBy: Deadline.MONDAY,
        reviewersNeededCount: 2,
        acceptedReviewers: ['B'],
        declinedReviewers: ['A', 'C', 'D', 'E'],
        pendingReviewers: [],
      };
      activeReviewRepo.getReviewByThreadIdOrFail = jest.fn().mockResolvedValue(review);

      await reviewCloser.closeReviewIfComplete(app, threadId);

      expect(chatService.replyToReviewThread).toHaveBeenCalledWith(
        app.client,
        threadId,
        `<@${requestorId}> 1 of 2 needed reviewers found. No more potential reviewers are available.`,
      );
      expect(activeReviewRepo.remove).toHaveBeenCalledWith(threadId);
    });

    it('should not close a review if there are still pending reviewers', async () => {
      const threadId = '111';
      const review: ActiveReview = {
        threadId: threadId,
        requestorId: '123',
        languages: ['Java'],
        requestedAt: new Date(),
        dueBy: Deadline.MONDAY,
        reviewersNeededCount: 2,
        acceptedReviewers: ['A'],
        declinedReviewers: [],
        pendingReviewers: [{ userId: '123', expiresAt: 1, messageTimestamp: '456' }],
      };
      activeReviewRepo.getReviewByThreadIdOrFail = jest.fn().mockResolvedValue(review);

      await reviewCloser.closeReviewIfComplete(app, threadId);

      expect(chatService.replyToReviewThread).not.toHaveBeenCalled();
      expect(activeReviewRepo.remove).not.toHaveBeenCalled();
    });
  });
});
