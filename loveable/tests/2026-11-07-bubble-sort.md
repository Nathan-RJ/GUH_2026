# Bubble sort

Bubble sort repeatedly compares adjacent values and swaps them when they are
out of order. After each pass the largest remaining value is in its final
position. Stop when a complete pass makes no swaps.

For [3, 1, 2], swap 3 and 1 to obtain [1, 3, 2], then swap 3 and 2 to obtain
[1, 2, 3]. The next pass makes no swaps. Worst-case time is O(n squared).
An implementation using a swapped flag has O(n) best-case time on sorted input.
The usual in-place implementation uses O(1) extra space.

This is a synthetic integration-test document, not private course material.
