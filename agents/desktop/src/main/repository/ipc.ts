import { R, type Result } from "../../../../../common/src/result";
import { IpcChannel, type RepositoryReply } from "../../shared/ipc";
import type { Problem } from "../../shared/repository";
import { pickFolder } from "../folder-picker";
import { rendererIpc } from "../renderer-ipc";
import type { RepositoryService } from "./service";

const reply = (result: Result<void, Problem>): RepositoryReply =>
  R.success(result.ok ? undefined : result.error);

/** Registers the renderer's repository handlers and forwards each state change to the window. */
export function registerRepositoryIpc(params: {
  repository: RepositoryService;
  rendererUrl: string;
}): void {
  const { repository } = params;
  const { handle, on, toRenderer } = rendererIpc(params.rendererUrl);
  repository.subscribe((state) =>
    toRenderer(IpcChannel.RepositoryChanged, state),
  );

  const withPicked =
    (use: (folder: string) => Promise<Result<void, Problem>>) =>
    async (event: Electron.IpcMainInvokeEvent): Promise<RepositoryReply> => {
      const picked = await pickFolder(event);
      if (!picked.ok)
        return reply(
          R.failure({
            message: "Alliance agent couldn't open the folder picker.",
            details: picked.error.message,
          }),
        );
      return picked.value
        ? reply(await use(picked.value))
        : R.success(undefined);
    };

  handle(IpcChannel.RepositoryState, () => R.success(repository.current()));
  handle(IpcChannel.RepositoryClone, async () =>
    reply(await repository.clone()),
  );
  handle(
    IpcChannel.RepositoryChangeCloneFolder,
    withPicked((folder) => repository.changeCloneFolder(folder)),
  );
  on(IpcChannel.RepositoryCancelClone, () => void repository.cancelClone());
  on(IpcChannel.RepositoryCancelUpdate, () => repository.cancelUpdate());
  handle(
    IpcChannel.RepositoryUseExisting,
    withPicked((folder) => repository.useExisting(folder)),
  );
  handle(IpcChannel.RepositoryUpdate, async () =>
    reply(await repository.update()),
  );
  handle(IpcChannel.RepositoryCheckAgain, async () => {
    await repository.checkAgain();
    return R.success(undefined);
  });
}
