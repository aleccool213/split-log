import { useEffect } from "react";
import { getRegistration } from "@/lib/push-client";

export function PushSetup() {
  useEffect(() => {
    void getRegistration();
  }, []);
  return null;
}
