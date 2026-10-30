import React, { useEffect, useMemo, useState } from "react";
import { ScrollView } from "react-native";
import BottomSheet from "../BottomSheet";
import FilterControl from "./FilterControl";
import ApplyBar from "./ApplyBar";
import { useLiveCount } from "../../hooks/useLiveCount";
import { clear, setValue, toQueryParams } from "../../utils/filterState";

// Compact sheet for a single filter (opened from its quick chip). Edits are staged on a copy of
// the state and only committed on "Show N results"; closing the sheet discards them.
export default function QuickFilterSheet({ filterId, state, config, onApply, onClose }) {
  const visible = !!filterId;
  const [draft, setDraft] = useState(state);
  // Keep showing the last filter while the sheet animates closed.
  const [shownId, setShownId] = useState(filterId);
  useEffect(() => {
    if (!visible) return;
    setShownId(filterId);
    setDraft(state);
  }, [visible, filterId]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when opened

  const filter = useMemo(
    () => config.contexts[state.context]?.filters.find((f) => f.id === shownId) || null,
    [config, state.context, shownId],
  );
  const live = useLiveCount(toQueryParams(draft, config), { enabled: visible });

  return (
    <BottomSheet visible={visible} onClose={onClose} title={filter?.label || ""} maxHeight={0.7}>
      {filter ? (
        <>
          <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <FilterControl filter={filter} title={false} value={draft.values[filter.id]} onChange={(v) => setDraft((d) => setValue(d, config, filter.id, v))} />
          </ScrollView>
          <ApplyBar
            live={live}
            clearLabel="Clear"
            clearDisabled={draft.values[filter.id] === undefined}
            onClear={() => setDraft((d) => clear(d, config, filter.id))}
            onApply={() => onApply(draft)}
          />
        </>
      ) : null}
    </BottomSheet>
  );
}
