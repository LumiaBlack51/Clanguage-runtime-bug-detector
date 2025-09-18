#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

// 学生信息结构体
typedef struct {
    char name[50];
    int id;
    float gpa;
    char major[30];
} Student;

// 课程信息结构体
typedef struct {
    char course_name[50];
    int course_id;
    int credits;
    char instructor[50];
} Course;

// 成绩单结构体
typedef struct {
    Student student;
    Course course;
    float grade;
    char semester[20];
} Transcript;

// 动态数组结构体
typedef struct {
    Student* students;
    size_t size;
    size_t capacity;
} StudentArray;

// 初始化动态数组
void student_array_init(StudentArray* arr, size_t initial_capacity) {
    arr->students = (Student*)malloc(initial_capacity * sizeof(Student));
    arr->size = 0;
    arr->capacity = initial_capacity;
}

// 向动态数组添加学生
void student_array_add(StudentArray* arr, Student student) {
    if (arr->size >= arr->capacity) {
        arr->capacity *= 2;
        arr->students = (Student*)realloc(arr->students, arr->capacity * sizeof(Student));
    }
    arr->students[arr->size++] = student;
}

// 释放动态数组
void student_array_free(StudentArray* arr) {
    free(arr->students);
    arr->students = NULL;
    arr->size = 0;
    arr->capacity = 0;
}

// 计算平均GPA
float calculate_average_gpa(StudentArray* arr) {
    if (arr->size == 0) {
        return 0.0f;
    }

    float total_gpa = 0.0f;
    for (size_t i = 0; i < arr->size; i++) {
        total_gpa += arr->students[i].gpa;
    }

    return total_gpa / arr->size;
}

// 查找最高GPA的学生
Student* find_top_student(StudentArray* arr) {
    if (arr->size == 0) {
        return NULL;
    }

    Student* top = &arr->students[0];
    for (size_t i = 1; i < arr->size; i++) {
        if (arr->students[i].gpa > top->gpa) {
            top = &arr->students[i];
        }
    }

    return top;
}

// 按专业分组统计
void count_students_by_major(StudentArray* arr) {
    const char* majors[] = {"Computer Science", "Mathematics", "Physics", "Chemistry", "Biology"};
    size_t major_counts[5] = {0};

    for (size_t i = 0; i < arr->size; i++) {
        for (size_t j = 0; j < 5; j++) {
            if (strcmp(arr->students[i].major, majors[j]) == 0) {
                major_counts[j]++;
                break;
            }
        }
    }

    printf("Students by major:\n");
    for (size_t i = 0; i < 5; i++) {
        printf("  %s: %zu students\n", majors[i], major_counts[i]);
    }
}

// 生成随机学生数据
Student generate_random_student(int id) {
    Student student;
    student.id = id;
    student.gpa = 2.0f + (rand() % 300) / 100.0f; // 2.0 to 5.0 GPA

    const char* names[] = {"Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry", "Ivy", "Jack"};
    const char* majors_list[] = {"Computer Science", "Mathematics", "Physics", "Chemistry", "Biology"};

    strcpy(student.name, names[rand() % 10]);
    strcpy(student.major, majors_list[rand() % 5]);

    return student;
}

// 复杂度测试函数 - O(n^2)排序
void bubble_sort_students(StudentArray* arr) {
    for (size_t i = 0; i < arr->size - 1; i++) {
        for (size_t j = 0; j < arr->size - i - 1; j++) {
            if (arr->students[j].gpa < arr->students[j + 1].gpa) {
                Student temp = arr->students[j];
                arr->students[j] = arr->students[j + 1];
                arr->students[j + 1] = temp;
            }
        }
    }
}

// 二分查找学生（假设已排序）
Student* binary_search_student(StudentArray* arr, int target_id) {
    size_t left = 0;
    size_t right = arr->size - 1;

    while (left <= right) {
        size_t mid = left + (right - left) / 2;

        if (arr->students[mid].id == target_id) {
            return &arr->students[mid];
        } else if (arr->students[mid].id < target_id) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    return NULL;
}

// 递归函数 - 计算斐波那契数列（用于复杂度测试）
long long fibonacci_recursive(int n) {
    if (n <= 1) {
        return n;
    }
    return fibonacci_recursive(n - 1) + fibonacci_recursive(n - 2);
}

// 迭代函数 - 计算斐波那契数列
long long fibonacci_iterative(int n) {
    if (n <= 1) {
        return n;
    }

    long long prev = 0;
    long long curr = 1;

    for (int i = 2; i <= n; i++) {
        long long next = prev + curr;
        prev = curr;
        curr = next;
    }

    return curr;
}

// 主函数 - 综合测试
int main() {
    srand(time(NULL));

    // 初始化学生数组
    StudentArray students;
    student_array_init(&students, 10);

    // 生成随机学生数据
    printf("Generating student data...\n");
    for (int i = 1; i <= 20; i++) {
        Student student = generate_random_student(i);
        student_array_add(&students, student);
    }

    // 显示所有学生信息
    printf("\nAll students:\n");
    for (size_t i = 0; i < students.size; i++) {
        printf("  ID: %d, Name: %s, Major: %s, GPA: %.2f\n",
               students.students[i].id,
               students.students[i].name,
               students.students[i].major,
               students.students[i].gpa);
    }

    // 计算统计信息
    float avg_gpa = calculate_average_gpa(&students);
    printf("\nAverage GPA: %.2f\n", avg_gpa);

    // 查找最高GPA学生
    Student* top_student = find_top_student(&students);
    if (top_student != NULL) {
        printf("Top student: %s (GPA: %.2f)\n", top_student->name, top_student->gpa);
    }

    // 按专业统计
    count_students_by_major(&students);

    // 复杂度测试
    printf("\nComplexity testing:\n");

    // 排序测试 (O(n^2))
    printf("Sorting students by GPA (descending)...\n");
    bubble_sort_students(&students);
    printf("Top 5 students after sorting:\n");
    for (size_t i = 0; i < 5 && i < students.size; i++) {
        printf("  %s: %.2f\n", students.students[i].name, students.students[i].gpa);
    }

    // 二分查找测试
    Student* found = binary_search_student(&students, 10);
    if (found != NULL) {
        printf("Found student ID 10: %s\n", found->name);
    }

    // 斐波那契数列测试
    printf("\nFibonacci sequence test:\n");
    for (int i = 0; i <= 10; i++) {
        printf("F(%d) = %lld (recursive), %lld (iterative)\n",
               i, fibonacci_recursive(i), fibonacci_iterative(i));
    }

    // 清理资源
    student_array_free(&students);

    printf("\nAll tests completed successfully!\n");
    return 0;
}