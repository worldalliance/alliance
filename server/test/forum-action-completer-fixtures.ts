import type { FormSchema } from "@alliance/common/forms/form-schema";
import { addMinutes } from "date-fns";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { EditableContent } from "src/forum/entities/editablecontent.entity";
import { Post } from "src/forum/entities/post.entity";
import {
  CustomValidator,
  CustomValidatorType,
} from "src/tasks/entities/customvalidator.entity";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { Tag } from "src/user/entities/tag.entity";
import { User } from "src/user/entities/user.entity";
import { createFormWithSnapshot, TestContext } from "./e2e-test-utils";

export function forumCompleterFixtures(ctx: TestContext) {
  const actionRepo = ctx.dataSource.getRepository(Action);
  const eventRepo = ctx.dataSource.getRepository(ActionEvent);
  const activityRepo = ctx.dataSource.getRepository(ActionActivity);
  const formRepo = ctx.dataSource.getRepository(Form);
  const formResponseRepo = ctx.dataSource.getRepository(FormResponse);
  const customValidatorRepo = ctx.dataSource.getRepository(CustomValidator);
  const postRepo = ctx.dataSource.getRepository(Post);
  const commentRepo = ctx.dataSource.getRepository(Comment);
  const editableContentRepo = ctx.dataSource.getRepository(EditableContent);
  const userRepo = ctx.dataSource.getRepository(User);

  const cleanup = async () => {
    await activityRepo.query("DELETE FROM action_activity");
    await eventRepo.query("DELETE FROM action_event");
    await actionRepo.query("DELETE FROM action");
    await formResponseRepo.query("DELETE FROM form_response");
    await formRepo.query("DELETE FROM form");
    await customValidatorRepo.query("DELETE FROM custom_validator");
    await commentRepo.query("DELETE FROM comment");
    await postRepo.query("DELETE FROM post");
    await editableContentRepo.query("DELETE FROM editable_content");
  };

  const createUser = async ({
    email,
    name,
    tags = [ctx.defaultTag],
  }: {
    email: string;
    name: string;
    tags?: Tag[];
  }) => userRepo.save(userRepo.create({ email, password: "pass", name, tags }));

  const createPost = async (author: User, title: string) => {
    return postRepo.save(
      postRepo.create({
        title,
        author,
        authorId: author.id,
        editableContent: editableContentRepo.create({
          body: "Post body",
          attachments: [],
        }),
      }),
    );
  };

  const createComment = async (params: {
    author: User;
    post: Post;
    body: string;
    parentId?: number;
  }) => {
    const { author, post, body, parentId } = params;
    return commentRepo.save(
      commentRepo.create({
        author,
        authorId: author.id,
        parentObjectType: CommentParentObject.Post,
        parentObjectId: post.id,
        parentId,
        editableContent: editableContentRepo.create({
          body,
          attachments: [],
        }),
      }),
    );
  };

  const createForumValidator = async (
    type: CustomValidatorType,
    postId: number,
  ) => {
    return customValidatorRepo.save(
      customValidatorRepo.create({
        type,
        idArgument: postId.toString(),
      }),
    );
  };

  const createFormWithValidator = async (validatorId: number) => {
    const schema: FormSchema = {
      pages: [
        {
          id: "page-1",
          fields: [
            {
              id: "reply",
              type: "input",
              kind: "text",
              label: "Reply",
              visibleIfFormula: {
                conditions: {
                  condition1: { kind: "validator", validatorId },
                },
                formula: "condition1",
              },
            },
          ],
        },
      ],
      outputViews: [],
      aggregateViews: [],
    };

    const { form } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Forum Action Form",
      schema,
    });
    return form;
  };

  const createActionWithEvents = async (params: {
    formId: number;
    now: Date;
    forumParticipationPostId?: number;
    forumParticipationIncludeChildren?: boolean;
  }) => {
    const {
      formId,
      now,
      forumParticipationPostId,
      forumParticipationIncludeChildren,
    } = params;
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Forum Action",
        category: [],
        body: "Action body",
        shortDescription: "Short description",
        onboarding: true,
        shouldCompleteAfterDeadline: false,
        visibilityMode: VisibilityMode.Public,
        isForumParticipationAction: true,
        forumParticipationPostId,
        forumParticipationIncludeChildren,
        taskFormId: formId,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      }),
    );

    await eventRepo.save([
      eventRepo.create({
        title: "Member phase",
        description: "Members take action",
        newStatus: ActionStatus.MemberAction,
        date: addMinutes(now, -30),
        action,
      }),
      eventRepo.create({
        title: "Resolution phase",
        description: "Action deadline",
        newStatus: ActionStatus.Resolution,
        date: addMinutes(now, 5),
        action,
      }),
    ]);

    return action;
  };

  return {
    cleanup,
    createUser,
    createPost,
    createComment,
    createForumValidator,
    createFormWithValidator,
    createActionWithEvents,
  };
}
