import { Test, TestingModule } from '@nestjs/testing';
import { ForumService } from './forum.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { Reply } from './entities/reply.entity';
import { Notification } from '../notifs/entities/notification.entity';
import { User } from '../user/user.entity';
import { ObjectLiteral, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CreatePostDto } from './dto/post.dto';

type MockRepository<T extends ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createMockRepository = <
  T extends ObjectLiteral,
>(): MockRepository<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('ForumService', () => {
  let service: ForumService;
  let postRepository: MockRepository<Post>;
  let replyRepository: MockRepository<Reply>;
  let notifRepository: MockRepository<Notification>;
  let userRepository: MockRepository<User>;

  beforeEach(async () => {
    postRepository = createMockRepository<Post>();
    replyRepository = createMockRepository<Reply>();
    notifRepository = createMockRepository<Notification>();
    userRepository = createMockRepository<User>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumService,
        {
          provide: getRepositoryToken(Post),
          useValue: postRepository,
        },
        {
          provide: getRepositoryToken(Reply),
          useValue: replyRepository,
        },
        {
          provide: getRepositoryToken(Notification),
          useValue: notifRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile();

    service = module.get<ForumService>(ForumService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(postRepository).toBeDefined();
  });

  describe('createPost', () => {
    it('should create a post', async () => {
      const createPostDto: CreatePostDto = {
        title: 'Test Post',
        content: 'Test content',
        actionId: 1,
      };
      const userId = 1;
      const post = { ...createPostDto, authorId: userId };

      postRepository.create?.mockReturnValue(post);
      postRepository.save?.mockResolvedValue(post);

      const result = await service.createPost(createPostDto, userId);

      expect(postRepository.create).toHaveBeenCalledWith({
        ...createPostDto,
        authorId: userId,
      });
      expect(postRepository.save).toHaveBeenCalledWith(post);
      expect(result).toEqual(post);
    });
  });

  describe('findAllPosts', () => {
    it('should return an array of posts', async () => {
      const posts = [{ id: 1, title: 'Test Post' }];
      postRepository.find?.mockResolvedValue(posts);

      const result = await service.findAllPosts();

      expect(postRepository.find).toHaveBeenCalledWith({
        relations: ['author', 'action'],
        order: { updatedAt: 'DESC' },
      });
      expect(result).toEqual(posts);
    });
  });

  describe('findPostsByAction', () => {
    it('should return posts for a specific action', async () => {
      const actionId = 1;
      const posts = [{ id: 1, title: 'Test Post', actionId }];
      postRepository.find?.mockResolvedValue(posts);

      const result = await service.findPostsByAction(actionId);

      expect(postRepository.find).toHaveBeenCalledWith({
        where: { actionId },
        relations: ['author', 'action'],
        order: { updatedAt: 'DESC' },
      });
      expect(result).toEqual(posts);
    });
  });

  describe('findOnePost', () => {
    it('should return a post by id', async () => {
      const postId = 1;
      const post = {
        id: postId,
        title: 'Test Post',
        replies: [
          { id: 1, createdAt: new Date(2022, 1, 1) },
          { id: 2, createdAt: new Date(2022, 0, 1) },
        ],
      };

      postRepository.findOne?.mockResolvedValue(post);

      const result = await service.findOnePost(postId);

      expect(postRepository.findOne).toHaveBeenCalledWith({
        where: { id: postId },
        relations: ['author', 'action', 'replies', 'replies.author'],
      });
      expect(result).toEqual(post);
      // Check if replies are sorted
      expect(result.replies[0].createdAt.getTime()).toBeLessThan(
        result.replies[1].createdAt.getTime(),
      );
    });

    it('should throw NotFoundException if post is not found', async () => {
      const postId = 999;
      postRepository.findOne?.mockResolvedValue(null);

      await expect(service.findOnePost(postId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createReply', () => {
    it('should create a reply', async () => {
      const postId = 1;
      const userId = 1;
      const createReplyDto = { content: 'Test reply', postId };
      const reply = { id: 1, ...createReplyDto, authorId: userId };
      const post = { id: postId, authorId: userId, author: { id: userId } };

    postRepository.findOne?.mockResolvedValue(post);
    userRepository.findOne
      ?.mockResolvedValueOnce({ id: post.authorId, name: 'Post Author' })
      .mockResolvedValueOnce({ id: userId, name: 'Reply Author' });
    replyRepository.create?.mockReturnValue(reply);
    replyRepository.save?.mockResolvedValue(reply);
    replyRepository.findOne?.mockResolvedValue({
      id: reply.id,
      content: reply.content,
      post,
      author: { id: userId },
    });

      const result = await service.createReply(createReplyDto, userId);

      expect(postRepository.findOne).toHaveBeenCalledWith({
        where: { id: postId },
        relations: ['author'],
      });
      expect(replyRepository.create).toHaveBeenCalledWith({
        ...createReplyDto,
        authorId: userId,
      });
      expect(postRepository.update).toHaveBeenCalled();
      expect(replyRepository.save).toHaveBeenCalledWith(reply);
      expect(notifRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: post.author,
          message: 'Reply Author replied to your forum post',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: reply.id,
          content: reply.content,
        }),
      );
    });

    it('should throw NotFoundException if post is not found', async () => {
      const postId = 999;
      const userId = 1;
      const createReplyDto = { content: 'Test reply', postId };

      postRepository.findOne?.mockResolvedValue(null);

      await expect(service.createReply(createReplyDto, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
