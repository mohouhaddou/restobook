import assert from "node:assert/strict";
import test from "node:test";
import { EditorDispatcher, GenericEditor } from "../bridge/EditorDispatcher";
import type { Job } from "../jobs/Job";

test("le dispatcher couvre les cinq rédactions", () => {
  const dispatcher = new EditorDispatcher();
  for (const id of ["discover", "sports", "kids", "stories", "gaming"] as const) dispatcher.register(new GenericEditor(id, id));
  for (const editor of ["discover", "sports", "kids", "stories", "gaming"] as const) {
    assert.equal(dispatcher.dispatch({ editor } as Job).id, editor);
  }
});
