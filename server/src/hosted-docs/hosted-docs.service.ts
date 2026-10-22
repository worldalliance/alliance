import {
  hostedDocFieldsSchema,
  hostedDocNotesSchema,
} from "@alliance/common/hostedDocs";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { isUniqueViolation } from "src/utils/db-errors";
import type { Repository } from "src/utils/Repository";
import type { ZodError } from "zod";
import { CreateHostedDocDto, UpdateHostedDocDto } from "./dto/hosted-doc.dto";
import { HostedDoc } from "./entities/hosted-doc.entity";

const NOT_FOUND_MESSAGE = "Document not found";
const PDF_MAGIC = Buffer.from("%PDF-");

const badRequest = (error: ZodError) =>
  new BadRequestException(error.issues.map((issue) => issue.message));

function assertPdf(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file) throw new BadRequestException("Attach a PDF file.");
  if (
    file.mimetype !== "application/pdf" ||
    !file.buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)
  )
    throw new BadRequestException("Only PDF files are accepted.");
  return file;
}

@Injectable()
export class HostedDocsService {
  private readonly logger = new Logger(HostedDocsService.name);
  private readonly bucket = process.env.ASSETS_BUCKET!;

  constructor(
    @InjectRepository(HostedDoc)
    private readonly repository: Repository<HostedDoc>,
    @Inject("S3_CLIENT") private readonly s3: S3Client,
  ) {}

  findAll(): Promise<HostedDoc[]> {
    return this.repository.find({
      relations: { uploadedBy: true, fileReplacedBy: true },
      order: { createdAt: "DESC" },
    });
  }

  private async findWithUsers(id: number): Promise<HostedDoc> {
    const doc = await this.repository.findOne({
      where: { id },
      relations: { uploadedBy: true, fileReplacedBy: true },
    });
    if (!doc) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return doc;
  }

  async create(params: {
    dto: CreateHostedDocDto;
    file: Express.Multer.File | undefined;
    adminId: number;
  }): Promise<HostedDoc> {
    const parsed = hostedDocFieldsSchema.safeParse(params.dto);
    if (!parsed.success) throw badRequest(parsed.error);
    const s3Key = await this.putFile(assertPdf(params.file));
    try {
      const saved = await this.repository.save(
        this.repository.create({
          ...parsed.data,
          s3Key,
          uploadedById: params.adminId,
        }),
      );
      return await this.findWithUsers(saved.id);
    } catch (error) {
      await this.deleteFile(s3Key);
      if (isUniqueViolation(error))
        throw new ConflictException("Another document already uses that ID.");
      throw error;
    }
  }

  async replaceFile(params: {
    id: number;
    file: Express.Multer.File | undefined;
    adminId: number;
  }): Promise<HostedDoc> {
    const s3Key = await this.putFile(assertPdf(params.file));
    let previousKey: string;
    try {
      previousKey = await this.repository.manager.transaction(
        async (manager) => {
          const doc = await manager.findOne(HostedDoc, {
            where: { id: params.id },
            lock: { mode: "pessimistic_write" },
          });
          if (!doc) throw new NotFoundException(NOT_FOUND_MESSAGE);
          await manager.update(
            HostedDoc,
            { id: doc.id },
            {
              s3Key,
              fileReplacedById: params.adminId,
              fileReplacedAt: new Date(),
            },
          );
          return doc.s3Key;
        },
      );
    } catch (error) {
      await this.deleteFile(s3Key);
      throw error;
    }
    await this.deleteFile(previousKey);
    return this.findWithUsers(params.id);
  }

  async update(id: number, dto: UpdateHostedDocDto): Promise<HostedDoc> {
    const notes = hostedDocNotesSchema.safeParse(dto.notes);
    if (!notes.success) throw badRequest(notes.error);
    const updated = await this.repository.update(id, { notes: notes.data });
    if (!updated.affected) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return this.findWithUsers(id);
  }

  async remove(id: number): Promise<void> {
    const deleted = await this.repository.softDelete(id);
    if (!deleted.affected) throw new NotFoundException(NOT_FOUND_MESSAGE);
  }

  async findBySlug(slug: string): Promise<HostedDoc> {
    const doc = await this.repository.findOne({ where: { slug } });
    if (!doc) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return doc;
  }

  countView(id: number): void {
    this.repository
      .increment({ id }, "views", 1)
      .catch((error) =>
        this.logger.error(`Could not count a view of document ${id}`, error),
      );
  }

  private async putFile(file: Express.Multer.File): Promise<string> {
    const key = `docs/${randomUUID()}.pdf`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: "application/pdf",
      }),
    );
    return key;
  }

  private async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      this.logger.error(`Could not delete ${key}`, error);
    }
  }
}
