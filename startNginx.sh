docker run -p 8005:8005 --net=medbook_default --rm --name nginx -v `pwd`/nginx.conf:/etc/nginx/nginx.conf nginx:stable
