import { queryOptions } from "@tanstack/react-query";
import { readFundamentals } from "./fundamentals.functions";
export const fundamentalsQuery = queryOptions({ queryKey: ["fundamentals-calendar"], queryFn: () => readFundamentals(), staleTime: 60000 });