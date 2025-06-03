import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { CreateReplyDto, ReplyDto, UpdateReplyDto } from './dto/reply.dto';
import { Post } from './entities/post.entity';
import { Reply } from './entities/reply.entity';
import { Notification } from '../notifs/entities/notification.entity';
import { User } from '../user/user.entity';

@Injectable()
export class ForumService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Reply)
    private replyRepository: Repository<Reply>,
    @InjectRepository(Notification)
    private notifRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createPost(
    createPostDto: CreatePostDto,
    userId: number,
  ): Promise<Post> {
    const post = this.postRepository.create({
      ...createPostDto,
      authorId: userId,
    });
    return this.postRepository.save(post);
  }

  async findAllPosts(): Promise<Post[]> {
    return this.postRepository.find({
      relations: ['author', 'action'],
      order: { updatedAt: 'DESC' },
    });
  }

  async findPostsByAction(actionId: number): Promise<Post[]> {
    return this.postRepository.find({
      where: { actionId },
      relations: ['author', 'action'],
      order: { updatedAt: 'DESC' },
    });
  }

  async findOnePost(id: number): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ['author', 'action', 'replies', 'replies.author'],
    });

    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    // Sort replies by creation date
    post.replies?.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return post;
  }

  async updatePost(
    id: number,
    updatePostDto: UpdatePostDto,
    userId: number,
  ): Promise<Post> {
    const post = await this.findOnePost(id);

    if (post.authorId !== userId) {
      throw new NotFoundException('You can only edit your own posts');
    }

    await this.postRepository.update(id, updatePostDto);
    return this.findOnePost(id);
  }

  async removePost(id: number, userId: number): Promise<void> {
    const post = await this.findOnePost(id);

    if (post.authorId !== userId) {
      throw new NotFoundException('You can only delete your own posts');
    }

    await this.postRepository.delete(id);
  }

  async createReply(
    createReplyDto: CreateReplyDto,
    userId: number,
  ): Promise<ReplyDto> {
    const post = await this.postRepository.findOne({
      where: { id: createReplyDto.postId },
      relations: ['author'],
    });

    if (!post) {
      throw new NotFoundException(
        `Post with ID "${createReplyDto.postId}" not found`,
      );
    }

    const reply = this.replyRepository.create({
      ...createReplyDto,
      authorId: userId,
    });

    await this.postRepository.update(createReplyDto.postId, {
      updatedAt: new Date(),
    });

    const postAuthor = await this.userRepository.findOne({
      where: { id: post.authorId },
    });
    if (!postAuthor) {
      throw new NotFoundException(
        `Post author with ID "${post.authorId}" not found`,
      );
    }

    // notify post author
    const notif = this.notifRepository.create({
      user: post.author,
      message: `${postAuthor.name} replied to your forum post`,
      category: 'forum',
      webAppLocation: `/forum/post/${post.id}`,
      mobileAppLocation: `/forum/post/${post.id}`, //TODO: mobile forum route,
    });
    await this.notifRepository.save(notif);

    reply.notification = notif;
    await this.replyRepository.save(reply);

    const loadedReply = await this.replyRepository.findOne({
      where: { id: reply.id },
      relations: ['author', 'post'],
    });
    if (!loadedReply) {
      throw new NotFoundException(`Reply with ID "${reply.id}" not found`);
    }

    return loadedReply;
  }

  async updateReply(
    id: number,
    updateReplyDto: UpdateReplyDto,
    userId: number,
  ): Promise<Reply> {
    const reply = await this.replyRepository.findOne({
      where: { id },
      relations: ['post'],
    });

    if (!reply) {
      throw new NotFoundException(`Reply with ID "${id}" not found`);
    }

    if (reply.authorId !== userId) {
      throw new NotFoundException('You can only edit your own replies');
    }

    await this.replyRepository.update(id, updateReplyDto);
    const updatedReply = await this.replyRepository.findOne({
      where: { id },
      relations: ['author', 'post'],
    });

    if (!updatedReply) {
      throw new NotFoundException(
        `Reply with ID "${id}" not found after update`,
      );
    }

    return updatedReply;
  }

  async removeReply(id: number, userId: number): Promise<void> {
    const reply = await this.replyRepository.findOne({
      where: { id },
    });

    if (!reply) {
      throw new NotFoundException(`Reply with ID "${id}" not found`);
    }

    if (reply.authorId !== userId) {
      throw new NotFoundException('You can only delete your own replies');
    }

    await this.replyRepository.delete(id);
  }

  async findPostsByUser(userId: number): Promise<Post[]> {
    return this.postRepository.find({
      where: { authorId: userId },
      relations: ['author', 'action'],
    });
  }
}
