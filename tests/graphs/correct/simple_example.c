#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// 简单的数学运算函数
int add(int a, int b) {
    return a + b;
}

int multiply(int a, int b) {
    return a * b;
}

// 字符串处理函数
void greet(const char* name) {
    printf("Hello, %s!\n", name);
}

// 数组操作函数
void print_array(int arr[], int size) {
    printf("Array contents: ");
    for (int i = 0; i < size; i++) {
        printf("%d ", arr[i]);
    }
    printf("\n");
}

// 主函数
int main() {
    // 变量声明和初始化
    int x = 10;
    int y = 20;
    int result = 0;
    char name[50] = "World";

    // 函数调用
    result = add(x, y);
    printf("Addition result: %d\n", result);

    result = multiply(x, y);
    printf("Multiplication result: %d\n", result);

    // 字符串操作
    greet(name);

    // 数组操作
    int numbers[] = {1, 2, 3, 4, 5};
    int array_size = sizeof(numbers) / sizeof(numbers[0]);
    print_array(numbers, array_size);

    // 条件语句
    if (result > 100) {
        printf("Result is greater than 100\n");
    } else {
        printf("Result is not greater than 100\n");
    }

    // 循环语句
    printf("Counting from 1 to 5:\n");
    for (int i = 1; i <= 5; i++) {
        printf("%d ", i);
    }
    printf("\n");

    return 0;
}