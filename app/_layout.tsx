// app/(tabs)/_layout.tsx
import React from "react";
import { Stack } from "expo-router";

export default function TabsLayout() {
  // ✅ Tabs(하단 Home/Explore) 제거하고 Stack으로만 구성
  // => 하단 탭바가 완전히 사라짐
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    >
      <Stack.Screen name="index" />
      {/* explore 라우트가 남아있어도 화면에 탭은 안 뜸 */}
      <Stack.Screen name="explore" />
    </Stack>
  );
}
