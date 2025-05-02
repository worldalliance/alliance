import { Test, TestingModule } from '@nestjs/testing';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { UpdateReplyDto } from './dto/update-reply.dto';
import { Post } from './entities/post.entity';
import { Reply } from './entities/reply.entity';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload, JWTTokenType } from '../auth/guards/auth.guard';

describe('ForumController', () => {
  let controller: ForumController;
  let service: ForumService;

  beforeEach(async () => {
    const mockForumService = {
      createPost: jest.fn(),
      findAllPosts: jest.fn(),
      findPostsByAction: jest.fn(),
      findOnePost: jest.fn(),
      updatePost: jest.fn(),
      removePost: jest.fn(),
      createReply: jest.fn(),
      updateReply: jest.fn(),
      removeReply: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForumController],
      providers: [
        JwtService,
        {
          provide: ForumService,
          useValue: mockForumService,
        },
      ],
    }).compile();

    controller = module.get<ForumController>(ForumController);
    service = module.get<ForumService>(ForumService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPost', () => {
    it('should create a post', async () => {
      const userId = 1;
      const createPostDto: CreatePostDto = {
        title: 'Test Post',
        content: 'Test content',
        actionId: 1,
      };
      const post: Partial<Post> = {
        id: 1,
        ...createPostDto,
        authorId: userId,
      };
      const userPayload: JwtPayload = {
        sub: userId,
        email: '',
        tokenType: JWTTokenType.access,
      };

      jest.spyOn(service, 'createPost').mockResolvedValue(post as Post);

      const result = await controller.createPost(createPostDto, userPayload);

      expect(service.createPost).toHaveBeenCalledWith(createPostDto, userId);
      expect(result).toBe(post);
    });
  });

  describe('findAllPosts', () => {
    it('should return an array of posts', async () => {
      const posts: Partial<Post>[] = [
        { id: 1, title: 'Post 1' },
        { id: 2, title: 'Post 2' },
      ];

      jest.spyOn(service, 'findAllPosts').mockResolvedValue(posts as Post[]);

      const result = await controller.findAllPosts();

      expect(service.findAllPosts).toHaveBeenCalled();
      expect(result).toBe(posts);
    });
  });

  describe('findPostsByAction', () => {
    it('should return posts for a specific action', async () => {
      const actionId = '1';
      const posts: Partial<Post>[] = [{ id: 1, title: 'Post 1', actionId: 1 }];

      jest
        .spyOn(service, 'findPostsByAction')
        .mockResolvedValue(posts as Post[]);

      const result = await controller.findPostsByAction(actionId);

      expect(service.findPostsByAction).toHaveBeenCalledWith(1); // Numeric conversion
      expect(result).toBe(posts);
    });
  });

  describe('findOnePost', () => {
    it('should return a post by id', async () => {
      const postId = '1';
      const post: Partial<Post> = {
        id: 1,
        title: 'Test Post',
      };

      jest.spyOn(service, 'findOnePost').mockResolvedValue(post as Post);

      const result = await controller.findOnePost(postId);

      expect(service.findOnePost).toHaveBeenCalledWith(1); // Numeric conversion
      expect(result).toBe(post);
    });
  });

  describe('updatePost', () => {
    it('should update a post', async () => {
      const postId = '1';
      const userId = 1;
      const updatePostDto: UpdatePostDto = {
        title: 'Updated Post',
      };
      const post: Partial<Post> = {
        id: 1,
        title: 'Updated Post',
      };
      const userPayload: JwtPayload = {
        sub: userId,
        email: '',
        tokenType: JWTTokenType.access,
      };

      jest.spyOn(service, 'updatePost').mockResolvedValue(post as Post);

      const result = await controller.updatePost(
        postId,
        updatePostDto,
        userPayload,
      );

      expect(service.updatePost).toHaveBeenCalledWith(1, updatePostDto, userId);
      expect(result).toBe(post);
    });
  });

  describe('createReply', () => {
    it('should create a reply', async () => {
      const userId = 1;
      const createReplyDto: CreateReplyDto = {
        content: 'Test reply',
        postId: 1,
      };
      const reply: Partial<Reply> = {
        id: 1,
        ...createReplyDto,
        authorId: userId,
      };
      const userPayload: JwtPayload = {
        sub: userId,
        email: '',
        tokenType: JWTTokenType.access,
      };

      jest.spyOn(service, 'createReply').mockResolvedValue(reply as Reply);

      const result = await controller.createReply(createReplyDto, userPayload);

      expect(service.createReply).toHaveBeenCalledWith(createReplyDto, userId);
      expect(result).toBe(reply);
    });
  });

  describe('updateReply', () => {
    it('should update a reply', async () => {
      const replyId = '1';
      const userId = 1;
      const updateReplyDto: UpdateReplyDto = {
        content: 'Updated reply',
      };
      const reply: Partial<Reply> = {
        id: 1,
        content: 'Updated reply',
      };

      jest.spyOn(service, 'updateReply').mockResolvedValue(reply as Reply);

      const result = await controller.updateReply(replyId, updateReplyDto, {
        sub: userId,
        email: '',
        tokenType: JWTTokenType.access,
      });

      expect(service.updateReply).toHaveBeenCalledWith(
        1,
        updateReplyDto,
        userId,
      );
      expect(result).toBe(reply);
    });
  });
});
