import type { FormResponseDto } from "@alliance/shared/client";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { act, renderHook } from "@testing-library/react";
import { useRespondentSearch } from "./useRespondentSearch";

const responses = ["Maria Alba", "Alba Reyes", "Ben Stone"].map((name, id) =>
  makeFormResponse({ id, answers: { name } }),
);
const getRespondentName = (response: FormResponseDto) =>
  String(response.answers.name);

const renderSearch = () => {
  const onSelect = jest.fn();
  const { result } = renderHook(() =>
    useRespondentSearch({ responses, getRespondentName, onSelect }),
  );
  return { result, onSelect };
};

it("lists matching respondents, names starting with the query first", () => {
  const { result } = renderSearch();
  act(() => result.current.setQuery("alba"));

  expect(result.current.results.map(({ name, idx }) => [name, idx])).toEqual([
    ["Alba Reyes", 1],
    ["Maria Alba", 0],
  ]);
});

it("selects a response and resets the search", () => {
  const { result, onSelect } = renderSearch();
  act(() => result.current.setQuery("alba"));
  act(() => result.current.select(1));

  expect(onSelect).toHaveBeenCalledWith(1);
  expect(result.current.query).toBe("");
});
