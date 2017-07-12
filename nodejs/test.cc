#include <bits/stdc++.h>
#include <unistd.h>
#define SZ(v) ((int)(v).size())

using namespace std;

typedef long long ll;
typedef pair<int, int> pii;
typedef pair<int, ll> pil;

char buf[100];

int main(){
	int input[2], output[2];
	pipe(input);
	pipe(output);
	pid_t pid = fork();
	if (pid == 0){
		close(input[1]);
		close(output[0]);
		dup2(input[0], STDIN_FILENO);
		dup2(output[1], STDOUT_FILENO);
		close(input[0]);
		close(output[1]);
		execl("./test", "test");
	}
	else {
		close(input[0]);
		close(output[1]);
		printf("Executed test: %ld\n", (long) pid);
		sprintf(buf, "message\n");
		write(input[1], buf, sizeof(buf));
		read(output[0], buf, sizeof(buf));
		printf("Received message: %s\n", buf);
		close(input[0]);
		close(output[1]);
		wait(NULL);
	}
	return 0;
}