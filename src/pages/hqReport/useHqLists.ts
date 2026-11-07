import { useEffect, useState } from "react";
import { loadTemplate, readTemplateLists, type TemplateLists } from "./hqReportCalc";

// HQ dropdown lists (sourcing channels, resignation reasons) read from the RAM GROUP
// template, shared by the report menu and the Manpower new-hire / resign forms.
let cache: Promise<TemplateLists> | null = null;

export function useHqLists(): TemplateLists | null {
  const [lists, setLists] = useState<TemplateLists | null>(null);
  useEffect(() => {
    cache ??= loadTemplate().then(readTemplateLists);
    let alive = true;
    cache.then(l => { if (alive) setLists(l); }).catch(() => { cache = null; });
    return () => { alive = false; };
  }, []);
  return lists;
}
