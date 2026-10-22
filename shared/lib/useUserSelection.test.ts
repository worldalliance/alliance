import { act, renderHook } from "@testing-library/react";
import { useUserSelection } from "./useUserSelection";

type User = { id: number; name: string | null };

const users: User[] = [
  { id: 1, name: "Ada" },
  { id: 2, name: "Adam" },
  { id: 3, name: null },
];
const nameOf = (user: User) => user.name;

const render = (params: {
  selectedUserIds: number[];
  users?: User[];
  single?: boolean;
  loading?: boolean;
  onChange?: (ids: number[]) => void;
}) =>
  renderHook(() =>
    useUserSelection({
      users: params.users ?? users,
      selectedUserIds: params.selectedUserIds,
      onChange: params.onChange ?? (() => {}),
      nameOf,
      missingUser: (id) => ({ id, name: null }),
      loading: params.loading ?? false,
      single: params.single ?? false,
    }),
  );

describe("useUserSelection", () => {
  it("matches unselected users by name", () => {
    const { result } = render({ selectedUserIds: [2] });
    act(() => result.current.setQuery(" ad "));

    expect(result.current.filteredUsers).toEqual([users[0]]);
  });

  it("keeps selected ids that are not in the user list visible", () => {
    const { result } = render({ selectedUserIds: [1, 99] });

    expect(result.current.selectedUsers).toEqual([
      users[0],
      { id: 99, name: null },
    ]);
  });

  it("replaces the selection and clears the query in single mode", () => {
    const onChange = jest.fn();
    const { result } = render({ selectedUserIds: [], single: true, onChange });
    act(() => result.current.setQuery("ada"));
    act(() => result.current.addUser(2));

    expect(onChange).toHaveBeenCalledWith([2]);
    expect(result.current.query).toBe("");
  });

  it("appends to a multi-selection and ignores an id already selected", () => {
    const onChange = jest.fn();
    const { result } = render({ selectedUserIds: [1], onChange });
    act(() => result.current.addUser(2));
    act(() => result.current.addUser(1));

    expect(onChange.mock.calls).toEqual([[[1, 2]]]);
  });

  it("removes a selected user", () => {
    const onChange = jest.fn();
    const { result } = render({ selectedUserIds: [1, 2], onChange });
    act(() => result.current.removeUser(1));

    expect(onChange).toHaveBeenCalledWith([2]);
  });

  it("stops offering matches once a single selection is made", () => {
    const { result } = render({ selectedUserIds: [1], single: true });
    act(() => result.current.setQuery("ad"));

    expect(result.current.canSelectMore).toBe(false);
    expect(result.current.filteredUsers).toEqual([]);
  });

  it("counts an unknown id toward a single selection until it is removed", () => {
    const onChange = jest.fn();
    const { result } = render({
      selectedUserIds: [99],
      single: true,
      onChange,
    });

    expect(result.current.canSelectMore).toBe(false);
    act(() => result.current.removeUser(99));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("caps matches at eight", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: i + 1,
      name: `Sam ${i}`,
    }));
    const { result } = render({ selectedUserIds: [], users: many });
    act(() => result.current.setQuery("sam"));

    expect(result.current.filteredUsers).toHaveLength(8);
  });

  it("explains why the input is disabled", () => {
    const loading = render({ selectedUserIds: [], loading: true }).result
      .current;
    expect(loading.inputDisabled).toBe(true);
    expect(loading.placeholder).toBe("Loading users…");

    const full = render({ selectedUserIds: [1], single: true }).result.current;
    expect(full.inputDisabled).toBe(true);
    expect(full.placeholder).toBe("Remove current selection to choose another");

    const open = render({ selectedUserIds: [1] }).result.current;
    expect(open.inputDisabled).toBe(false);
    expect(open.placeholder).toBe("Search by name");
  });
});
