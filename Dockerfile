FROM node:24-alpine
WORKDIR /app
COPY server.js add-user.js snapshot.js ./
COPY public ./public
ENV DATA_DIR=/data
VOLUME /data
EXPOSE 4777
CMD ["node", "server.js"]
