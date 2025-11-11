import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Group, TextInput } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const getJson = useJson(state => state.getJson);
  const setJson = useJson(state => state.setJson);
  const setContents = useFile(state => state.setContents);

  const [editMode, setEditMode] = React.useState(false);
  const [formState, setFormState] = React.useState<Array<{ key: string | null; value: string }>>([]);

  React.useEffect(() => {
    // initialize form state whenever node changes
    const rows = nodeData?.text ?? [];
    const initial = rows
      .filter(r => r.type !== "array" && r.type !== "object")
      .map(r => ({ key: r.key ?? null, value: r.value == null ? "" : String(r.value) }));
    setFormState(initial);
    setEditMode(false);
  }, [nodeData]);

  const parseValue = (val: string) => {
    try {
      return JSON.parse(val);
    } catch (e) {
      // treat as plain string
      return val;
    }
  };

  const applyEdits = () => {
    try {
      const raw = getJson();
      const parsed = raw ? JSON.parse(raw) : undefined;

      if (parsed === undefined) return;

      const path = nodeData?.path ?? [];

      // helper to get parent and key
      const parentPath = path.slice(0, -1);
      const lastSeg = path[path.length - 1];

      const parent = parentPath.reduce((acc: any, seg: any) => acc?.[seg], parsed);

      // If single unnamed value (no keys present), set the value at the path
      const isSingleUnnamed = (nodeData?.text?.length === 1 && nodeData?.text[0].key == null) ?? false;

      if (isSingleUnnamed) {
        const newVal = parseValue(formState[0]?.value ?? "");
        if (path.length === 0) {
          // root value
          const newJson = JSON.stringify(newVal, null, 2);
          setJson(newJson);
          setContents({ contents: newJson });
        } else if (parent !== undefined && lastSeg !== undefined) {
          parent[lastSeg] = newVal;
          const newJson = JSON.stringify(parsed, null, 2);
          setJson(newJson);
          setContents({ contents: newJson });
        }
      } else {
        // object-like: set each key on the target object (or root if path empty)
        const target = path.length === 0 ? parsed : path.reduce((acc: any, seg: any) => acc?.[seg], parsed);
        if (target && typeof target === "object") {
          formState.forEach(f => {
            if (f.key) target[f.key] = parseValue(f.value);
          });
          const newJson = JSON.stringify(parsed, null, 2);
          setJson(newJson);
          setContents({ contents: newJson });
        }
      }

      setEditMode(false);
      onClose?.();
    } catch (err) {
      // fallback: alert error
      // eslint-disable-next-line no-alert
      alert("Failed to apply edits: " + String(err));
    }
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Group gap="xs">
              {nodeData && (
                <Button size="xs" variant="outline" onClick={() => setEditMode(v => !v)}>
                  {editMode ? "Cancel" : "Edit"}
                </Button>
              )}
              <CloseButton onClick={onClose} />
            </Group>
          </Flex>

          {!editMode && (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          )}

          {editMode && (
            <Stack>
              {(formState.length === 0 && <Text color="dimmed">No editable fields</Text>) || (
                formState.map((f, i) => (
                  <TextInput
                    key={i}
                    label={f.key ?? "value"}
                    value={f.value}
                    onChange={e =>
                      setFormState(s => s.map((row, idx) => (idx === i ? { ...row, value: e.currentTarget.value } : row)))
                    }
                  />
                ))
              )}

              <Group justify="right">
                <Button size="xs" variant="default" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
                <Button size="xs" onClick={applyEdits}>
                  Save
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>

        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
