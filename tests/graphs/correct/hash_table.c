#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

// 哈希表节点结构体
typedef struct HashNode {
    char* key;
    int value;
    struct HashNode* next;
} HashNode;

// 哈希表结构体
typedef struct HashTable {
    HashNode** buckets;
    size_t size;
    size_t count;
} HashTable;

// 计算字符串哈希值的函数
size_t hash_function(const char* key, size_t table_size) {
    size_t hash = 0;
    size_t prime = 31;

    for (size_t i = 0; key[i] != '\0'; i++) {
        hash = (hash * prime + key[i]) % table_size;
    }

    return hash;
}

// 创建哈希表
HashTable* hash_table_create(size_t size) {
    HashTable* table = (HashTable*)malloc(sizeof(HashTable));
    if (table == NULL) {
        return NULL;
    }

    table->buckets = (HashNode**)calloc(size, sizeof(HashNode*));
    if (table->buckets == NULL) {
        free(table);
        return NULL;
    }

    table->size = size;
    table->count = 0;
    return table;
}

// 销毁哈希表
void hash_table_destroy(HashTable* table) {
    if (table == NULL) {
        return;
    }

    for (size_t i = 0; i < table->size; i++) {
        HashNode* node = table->buckets[i];
        while (node != NULL) {
            HashNode* temp = node;
            node = node->next;
            free(temp->key);
            free(temp);
        }
    }

    free(table->buckets);
    free(table);
}

// 插入键值对
int hash_table_insert(HashTable* table, const char* key, int value) {
    if (table == NULL || key == NULL) {
        return -1;
    }

    size_t index = hash_function(key, table->size);
    HashNode* node = table->buckets[index];

    // 检查键是否已存在
    while (node != NULL) {
        if (strcmp(node->key, key) == 0) {
            node->value = value;
            return 0;
        }
        node = node->next;
    }

    // 创建新节点
    HashNode* new_node = (HashNode*)malloc(sizeof(HashNode));
    if (new_node == NULL) {
        return -1;
    }

    new_node->key = strdup(key);
    if (new_node->key == NULL) {
        free(new_node);
        return -1;
    }

    new_node->value = value;
    new_node->next = table->buckets[index];
    table->buckets[index] = new_node;
    table->count++;

    return 0;
}

// 查找值
int hash_table_get(HashTable* table, const char* key, int* value) {
    if (table == NULL || key == NULL || value == NULL) {
        return -1;
    }

    size_t index = hash_function(key, table->size);
    HashNode* node = table->buckets[index];

    while (node != NULL) {
        if (strcmp(node->key, key) == 0) {
            *value = node->value;
            return 0;
        }
        node = node->next;
    }

    return -1; // 键不存在
}

// 删除键值对
int hash_table_remove(HashTable* table, const char* key) {
    if (table == NULL || key == NULL) {
        return -1;
    }

    size_t index = hash_function(key, table->size);
    HashNode* node = table->buckets[index];
    HashNode* prev = NULL;

    while (node != NULL) {
        if (strcmp(node->key, key) == 0) {
            if (prev == NULL) {
                table->buckets[index] = node->next;
            } else {
                prev->next = node->next;
            }

            free(node->key);
            free(node);
            table->count--;
            return 0;
        }

        prev = node;
        node = node->next;
    }

    return -1; // 键不存在
}

// 获取哈希表大小
size_t hash_table_size(HashTable* table) {
    return table != NULL ? table->count : 0;
}

// 打印哈希表内容
void hash_table_print(HashTable* table) {
    if (table == NULL) {
        return;
    }

    printf("HashTable (size: %zu, count: %zu):\n", table->size, table->count);
    for (size_t i = 0; i < table->size; i++) {
        if (table->buckets[i] != NULL) {
            printf("  Bucket %zu: ", i);
            HashNode* node = table->buckets[i];
            while (node != NULL) {
                printf("(%s: %d) ", node->key, node->value);
                node = node->next;
            }
            printf("\n");
        }
    }
}

// 测试哈希表功能
int main() {
    // 创建哈希表
    HashTable* table = hash_table_create(10);
    if (table == NULL) {
        printf("Failed to create hash table\n");
        return 1;
    }

    // 插入一些键值对
    hash_table_insert(table, "apple", 5);
    hash_table_insert(table, "banana", 7);
    hash_table_insert(table, "cherry", 3);
    hash_table_insert(table, "date", 9);
    hash_table_insert(table, "elderberry", 2);

    // 打印哈希表
    hash_table_print(table);

    // 查找值
    int value;
    if (hash_table_get(table, "banana", &value) == 0) {
        printf("Found banana: %d\n", value);
    }

    // 更新值
    hash_table_insert(table, "banana", 10);
    if (hash_table_get(table, "banana", &value) == 0) {
        printf("Updated banana: %d\n", value);
    }

    // 删除键值对
    hash_table_remove(table, "cherry");
    printf("After removing cherry:\n");
    hash_table_print(table);

    // 获取大小
    printf("Hash table size: %zu\n", hash_table_size(table));

    // 销毁哈希表
    hash_table_destroy(table);

    printf("Hash table test completed successfully!\n");
    return 0;
}