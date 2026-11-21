FROM php:8.3-apache
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev libonig-dev \
    && docker-php-ext-install pdo_pgsql pgsql mbstring fileinfo \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /var/www/html
COPY . /var/www/html/
RUN mkdir -p /var/www/html/private_uploads \
    && chown -R www-data:www-data /var/www/html/private_uploads \
    && chmod 700 /var/www/html/private_uploads
RUN printf "upload_max_filesize=6M\npost_max_size=32M\nmax_file_uploads=10\nmemory_limit=256M\n" > /usr/local/etc/php/conf.d/portal.ini
EXPOSE 80
