#include <bits/stdc++.h>
#define SZ(v) ((int)(v).size())

using namespace std;

typedef long long ll;
typedef pair<int, int> pii;
typedef pair<int, ll> pil;

int board[19][19];

int mr(int i){ return rand()%i; }

int main(){
	srand(unsigned(time(NULL)));
	memset(board, -1, sizeof(board));
	int u, v, c;
	scanf("%d", &c);
	if (c == 0){
		board[9][9] = c;
		printf("9 9\n");
		fflush(stdout);
		for (int i=0; i<2; i++){
			scanf("%d%d", &u, &v);
			board[u][v] = c^1;
		}
	}
	else {
		scanf("%d%d", &u, &v);
		board[u][v] = c^1;
	}
	for (;;){
		for (int i=0; i<2; i++){
			int x, y;
			for (;;){
				x = rand()%19;
				y = rand()%19;
				if (board[x][y] == -1) break;
			}
			board[x][y] = c;
			printf("%d %d\n", x, y);
			fflush(stdout);
		}
		for (int i=0; i<2; i++){
			scanf("%d%d", &u, &v);
			board[u][v] = c^1;
		}
	}
	return 0;
}
